/**
 * Web Bluetooth 客户端：仅适配 Timemore DOT（TES017）。
 * Chrome 桌面端 + localhost 安全上下文运行。
 *
 * 连接流程：requestDevice（需用户手势）→ GATT → 订阅 0xFFF1 通知 →
 * 初始化读取序列 → 10s 保活周期（官方 App 行为，HW 命令被接受的前提）。
 */
import {
  buildRead,
  buildWrite,
  CMD_BATTERY,
  CMD_DEVICE_NAME,
  CMD_FIRMWARE,
  CMD_INIT13,
  CMD_KEEPALIVE,
  CMD_POWER_OFF,
  CMD_TARE,
  CMD_TIMER,
  CMD_UNIT,
  DOT_MODEL_NUMBER,
  FRAME_KEEPALIVE_WRITE,
  FRAME_TARE,
  FRAME_TIMER_PAUSE,
  FRAME_TIMER_RESET,
  FRAME_TIMER_START,
  parseFrame,
  UUID_DEVICE_INFO_SERVICE,
  UUID_FIRMWARE_REVISION,
  UUID_MANUFACTURER,
  UUID_MODEL_NUMBER,
  UUID_NOTIFY_CHAR,
  UUID_SERVICE,
  UUID_WRITE_CHAR,
  type ScaleEvent,
} from './frames'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export interface DeviceInfo {
  /** BLE 广播名 */
  bleName?: string
  /** Device Information Service: 0x2A24，DOT 应为 TES017 */
  modelNumber?: string
  firmware?: string
  manufacturer?: string
  /** 协议 0x0C 设备名 */
  scaleName?: string
  /** 型号与 TES017 不符 */
  modelMismatch?: boolean
}

export interface ScaleClientCallbacks {
  onEvent: (e: ScaleEvent) => void
  onStateChange: (state: ConnectionState) => void
  onDeviceInfo: (info: DeviceInfo) => void
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** GATT 连接超时：macOS 上连接挂起可能很久，超时后主动断开重试 */
const GATT_CONNECT_TIMEOUT_MS = 10_000
/** 连接重试次数（BLE 瞬态失败很常见） */
const GATT_CONNECT_ATTEMPTS = 3
const GATT_RETRY_DELAY_MS = 500

/** 带超时的 Promise（Web Bluetooth 无原生超时） */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/**
 * 分阶段连接错误：附带阶段名与按概率排序的排查清单，便于界面直接展示。
 * Web Bluetooth 的原始错误常缺少上下文（如 "Unsupported device."、"Connection attempt failed."）。
 */
export class ScaleConnectError extends Error {
  readonly stage: string
  readonly hints: string[]

  constructor(stage: string, cause: unknown, hints: string[] = []) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause)
    const domName = cause instanceof DOMException && cause.name ? `（${cause.name}）` : ''
    super(`${stage}：${causeMessage}${domName}`)
    this.name = 'ScaleConnectError'
    this.stage = stage
    this.hints = hints
  }
}

/**
 * GATT 连接失败排查清单（按实测概率排序）。
 * 首位是 macOS 系统级旧绑定：选择器里显示「已配对」而连接被拒，是粘滞 bond 的典型症状，
 * 因为 Chromium 在 macOS 只把连接透传给 CoreBluetooth（connectPeripheral:options:nil），不处理配对状态。
 */
const CONNECT_FAIL_HINTS = [
  '若设备在选择器里显示「已配对」：旧绑定会导致连接被拒——到 macOS「系统设置 → 蓝牙」移除该设备，并用官方 App「忘记设备」清除秤侧绑定，然后重新连接',
  '秤可能已被其他设备占用（手机官方 App、另一 Chrome 标签页、系统蓝牙自动连接）：BLE 通常只允许一个连接，请关闭手机蓝牙/退出 App',
  '秤可能处于白名单广播：长按秤的蓝牙键进入配对模式后再试',
  '仍失败时打开 chrome://bluetooth-internals 点 Connect，判断是系统层还是设备层问题',
]
  '常见原因：① 秤已被其他设备占用（手机官方 App、另一 Chrome 标签页或系统蓝牙），BLE 通常只允许一个连接——请关闭手机蓝牙/退出 App 后重试；② 秤处于白名单广播或已绑定状态，长按秤的蓝牙键进入配对模式，或先用官方 App「忘记设备」；③ 可在 chrome://bluetooth-internals 中查看该设备并点 Connect 验证。'

/** HW 写命令需要近期保活 ACK 才会被秤接受（HCI 逆向结论） */
const CONTROL_ACK_STALE_MS = 12_000
const CONTROL_ACK_WAIT_MS = 4_000
const WRITE_ACK_WAIT_MS = 1_500

export class ScaleClient {
  readonly isSimulator = false

  private device: BluetoothDevice | null = null
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null
  /** 当前订阅的通知特征与监听器（重连时先移除，避免重复注册导致事件双发） */
  private notifyChar: BluetoothRemoteGATTCharacteristic | null = null
  private notifyHandler = (evt: Event): void => {
    const dv = (evt.target as BluetoothRemoteGATTCharacteristic).value
    if (!dv) return
    const event = parseFrame(dv)
    if (event) this.handleEvent(event)
  }
  private writeQueue: Promise<void> = Promise.resolve()
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null
  private lastKeepaliveAck = 0
  private deviceInfo: DeviceInfo = {}
  /** 等待写 ACK 的监听器（waitWriteAck 注册，各自核对命令字） */
  private ackWaiters = new Set<(e: ScaleEvent) => void>()

  constructor(private cb: ScaleClientCallbacks) {}

  get isConnected() {
    return this.device?.gatt?.connected ?? false
  }

  get info() {
    return this.deviceInfo
  }

  /** 是否已选择过设备（失败后可用 reconnect 免选择器重试） */
  get hasSelectedDevice() {
    return this.device !== null
  }

  /** 连接新设备（必须由用户手势触发，如按钮点击） */
  async connect(opts: { showAllDevices?: boolean } = {}): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('当前浏览器不支持 Web Bluetooth，请使用桌面版 Chrome')
    }
    // 适配器/权限预检：不可用时直接给出明确原因，避免后续含糊的失败
    try {
      if (navigator.bluetooth.getAvailability) {
        const available = await navigator.bluetooth.getAvailability()
        if (!available) {
          throw new Error(
            '蓝牙不可用或未授权：请确认系统蓝牙已开启，并在「系统设置 → 隐私与安全性 → 蓝牙」中允许 Chrome 使用蓝牙',
          )
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('蓝牙不可用')) throw e
      // getAvailability 自身异常不阻塞连接尝试
    }

    this.cb.onStateChange('connecting')
    let device: BluetoothDevice
    try {
      device = await navigator.bluetooth.requestDevice({
        ...(opts.showAllDevices
          ? { acceptAllDevices: true }
          : { filters: [{ namePrefix: 'TIMEMORE' }] }),
        optionalServices: [UUID_SERVICE, UUID_DEVICE_INFO_SERVICE],
      })
    } catch (e) {
      this.cb.onStateChange('disconnected')
      throw new ScaleConnectError('选择设备', e, [
        '设备列表中没有你的秤时：确认秤已开机、与电脑距离 1 米内',
        '长按秤的蓝牙键进入配对广播后再试',
        '也可改用「显示全部设备」绕过名称前缀过滤',
      ])
    }

    this.device = device
    device.addEventListener('gattserverdisconnected', () => this.handleDisconnect())
    this.deviceInfo = { bleName: device.name ?? undefined }
    this.cb.onDeviceInfo({ ...this.deviceInfo })
    try {
      await this.setupGatt()
    } catch (e) {
      this.cb.onStateChange('disconnected')
      throw e
    }
  }

  /** 重连已配对设备（免用户手势；页面刷新后引用丢失需重新 connect） */
  async reconnect(): Promise<void> {
    if (!this.device) throw new Error('没有可重连的设备，请重新连接')
    this.cb.onStateChange('connecting')
    try {
      await this.setupGatt()
    } catch (e) {
      this.cb.onStateChange('disconnected')
      throw e
    }
  }

  async disconnect(): Promise<void> {
    this.stopKeepalive()
    // 主动停止通知并解绑监听，避免设备侧继续推送与残留回调
    if (this.notifyChar) {
      const char = this.notifyChar
      this.notifyChar = null
      char.removeEventListener('characteristicvaluechanged', this.notifyHandler)
      try {
        await char.stopNotifications()
      } catch {
        /* 设备已断开时 stopNotifications 会抛错，忽略 */
      }
    }
    this.writeChar = null
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect()
    } else {
      this.handleDisconnect()
    }
  }

  // ── 命令 ─────────────────────────────────────────────────────────────

  /** 硬件去皮。返回 false 表示未收到 ACK（调用方回退软件去皮） */
  async tare(): Promise<boolean> {
    return this.sendHwCommand(FRAME_TARE, CMD_TARE)
  }

  async timerStart(): Promise<boolean> {
    return this.sendHwCommand(FRAME_TIMER_START, CMD_TIMER)
  }

  async timerPause(): Promise<boolean> {
    return this.sendHwCommand(FRAME_TIMER_PAUSE, CMD_TIMER)
  }

  async timerReset(): Promise<boolean> {
    return this.sendHwCommand(FRAME_TIMER_RESET, CMD_TIMER)
  }

  async powerOff(): Promise<boolean> {
    return this.sendHwCommand(buildWrite(CMD_POWER_OFF), CMD_POWER_OFF)
  }

  // ── 内部 ─────────────────────────────────────────────────────────────

  private async setupGatt(): Promise<void> {
    const device = this.device
    if (!device) throw new Error('尚未选择设备，请先连接')
    await this.connectGatt(device)

    const server = device.gatt!
    let service: BluetoothRemoteGATTService
    try {
      service = await withTimeout(server.getPrimaryService(UUID_SERVICE), 8_000, '服务发现超时')
    } catch (e) {
      throw new ScaleConnectError('服务发现（0xFFF0）', e, [
        '请确认设备为 Timemore DOT（TES017）',
        '其他型号（如 Basic3 Link）不在本应用支持范围',
        '若固件被修改过，服务 UUID 可能不同',
      ])
    }

    let notifyChar: BluetoothRemoteGATTCharacteristic
    try {
      notifyChar = await service.getCharacteristic(UUID_NOTIFY_CHAR)
      this.writeChar = await service.getCharacteristic(UUID_WRITE_CHAR)
    } catch (e) {
      throw new ScaleConnectError('特征值获取（0xFFF1 / 0xFFF2）', e, [
        '设备特征与协议不符，可能不是 DOT（TES017）',
        '若固件异常，可尝试重新上电后再连',
      ])
    }

    try {
      await notifyChar.startNotifications()
      this.notifyChar = notifyChar
      // 同一特征重连时先移除旧 handler，避免事件重复分发
      notifyChar.removeEventListener('characteristicvaluechanged', this.notifyHandler)
      notifyChar.addEventListener('characteristicvaluechanged', this.notifyHandler)
    } catch (e) {
      throw new ScaleConnectError('订阅重量通知（0xFFF1）', e, [
        '连接已建立但订阅失败，秤可能被其他 App 占用，请断开后重试',
        '若系统蓝牙里显示「已配对」，先移除该配对再连',
      ])
    }

    this.cb.onStateChange('connected')
    void this.readDeviceInfo()
    await this.sendInitSequence()
    this.startKeepalive()
  }

  /**
   * 建立 GATT 连接：带 10s 超时与最多 3 次重试。
   * macOS 上 BLE 连接失败常是瞬态的（设备刚唤醒、上一次连接未释放），重试可解决大部分情况。
   */
  private async connectGatt(device: BluetoothDevice): Promise<void> {
    const gatt = device.gatt
    if (!gatt) {
      throw new ScaleConnectError('连接阶段（GATT）', new Error('设备不提供 GATT 接口'), CONNECT_FAIL_HINTS)
    }
    let lastError: unknown
    for (let attempt = 1; attempt <= GATT_CONNECT_ATTEMPTS; attempt++) {
      try {
        if (gatt.connected) gatt.disconnect()
        await withTimeout(gatt.connect(), GATT_CONNECT_TIMEOUT_MS, '连接超时（10 秒）')
        return
      } catch (e) {
        lastError = e
        console.warn(`[ble] GATT 连接失败（第 ${attempt}/${GATT_CONNECT_ATTEMPTS} 次）`, e)
        if (attempt < GATT_CONNECT_ATTEMPTS) {
          try {
            gatt.disconnect()
          } catch {
            /* 未连接时 disconnect 会抛错，忽略 */
          }
          await sleep(GATT_RETRY_DELAY_MS)
        }
      }
    }
    throw new ScaleConnectError('连接阶段（GATT）', lastError, CONNECT_FAIL_HINTS)
  }

  private handleEvent(e: ScaleEvent): void {
    for (const waiter of [...this.ackWaiters]) waiter(e)
    if (e.type === 'writeAck' && e.cmd === CMD_KEEPALIVE) {
      this.lastKeepaliveAck = Date.now()
    }
    if (e.type === 'readResp') {
      if (e.cmd === CMD_DEVICE_NAME) {
        this.deviceInfo = { ...this.deviceInfo, scaleName: new TextDecoder().decode(e.data) }
        this.cb.onDeviceInfo({ ...this.deviceInfo })
      } else if (e.cmd === CMD_FIRMWARE) {
        this.deviceInfo = { ...this.deviceInfo, firmware: new TextDecoder().decode(e.data) }
        this.cb.onDeviceInfo({ ...this.deviceInfo })
      }
    }
    this.cb.onEvent(e)
  }

  private async readDeviceInfo(): Promise<void> {
    try {
      const svc = await this.device!.gatt!.getPrimaryService(UUID_DEVICE_INFO_SERVICE)
      const readStr = async (uuid: string) => {
        try {
          const c = await svc.getCharacteristic(uuid)
          const v = await c.readValue()
          return new TextDecoder().decode(v)
        } catch {
          return undefined
        }
      }
      const modelNumber = await readStr(UUID_MODEL_NUMBER)
      this.deviceInfo = {
        ...this.deviceInfo,
        modelNumber,
        firmware: (await readStr(UUID_FIRMWARE_REVISION)) ?? this.deviceInfo.firmware,
        manufacturer: await readStr(UUID_MANUFACTURER),
        modelMismatch: !!modelNumber && modelNumber !== DOT_MODEL_NUMBER,
      }
      this.cb.onDeviceInfo({ ...this.deviceInfo })
    } catch {
      // Device Information Service 读取失败不阻塞连接
    }
  }

  private async sendInitSequence(): Promise<void> {
    // 官方 App 初始化读取序列 + 文档命令；0x13/0x08 为抓包观测值，无害保留
    const cmds = [CMD_FIRMWARE, CMD_BATTERY, CMD_TIMER, CMD_UNIT, CMD_DEVICE_NAME, CMD_INIT13, CMD_KEEPALIVE]
    for (const cmd of cmds) {
      this.enqueue(buildRead(cmd))
    }
  }

  private startKeepalive(): void {
    this.stopKeepalive()
    // 官方 App 每 10s：读 0x08 + 写 0x08（app 活跃标志），HW 命令依赖近期 ACK
    this.enqueue(buildRead(CMD_KEEPALIVE))
    this.enqueue(FRAME_KEEPALIVE_WRITE)
    this.keepaliveTimer = setInterval(() => {
      this.enqueue(buildRead(CMD_KEEPALIVE))
      this.enqueue(FRAME_KEEPALIVE_WRITE)
    }, 10_000)
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer)
      this.keepaliveTimer = null
    }
  }

  /** HW 写命令：先确保保活 ACK 新鲜，再发送并等待 ACK */
  private async sendHwCommand(bytes: Uint8Array<ArrayBuffer>, cmd: number): Promise<boolean> {
    if (!this.isConnected) return false
    if (Date.now() - this.lastKeepaliveAck > CONTROL_ACK_STALE_MS) {
      const ackBefore = this.lastKeepaliveAck
      this.enqueue(buildRead(CMD_KEEPALIVE))
      this.enqueue(FRAME_KEEPALIVE_WRITE)
      const deadline = Date.now() + CONTROL_ACK_WAIT_MS
      while (this.lastKeepaliveAck === ackBefore && Date.now() < deadline) {
        await sleep(50)
      }
    }
    const ackPromise = this.waitWriteAck(cmd, WRITE_ACK_WAIT_MS)
    this.enqueue(bytes)
    return ackPromise
  }

  /** 等待指定命令的写 ACK；超时按失败处理 */
  private waitWriteAck(cmd: number, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const onEvent = (e: ScaleEvent) => {
        if (e.type === 'writeAck' && e.cmd === cmd) {
          cleanup()
          resolve(e.ok)
        }
      }
      const timer = setTimeout(() => {
        cleanup()
        resolve(false)
      }, timeoutMs)
      const cleanup = () => {
        clearTimeout(timer)
        this.ackWaiters.delete(onEvent)
      }
      this.ackWaiters.add(onEvent)
    })
  }

  /** 串行写队列，写间隔 ≥100ms（write-without-response 突发会丢包） */
  private enqueue(bytes: Uint8Array<ArrayBuffer>): void {
    this.writeQueue = this.writeQueue
      .then(async () => {
        if (!this.writeChar) return
        try {
          await this.writeChar.writeValueWithoutResponse(bytes)
        } catch {
          // 单帧写失败不阻塞队列；断线由 gattserverdisconnected 统一处理
        }
        await sleep(100)
      })
      .catch(() => {})
  }

  private handleDisconnect(): void {
    this.stopKeepalive()
    this.cb.onStateChange('disconnected')
  }
}
