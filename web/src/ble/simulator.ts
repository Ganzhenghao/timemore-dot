/**
 * 仿真秤：产生与真机相同的协议帧字节流，经同一 parseFrame 解析路径分发事件。
 * 用于无硬件开发与端到端 GUI 测试；支持速率注水与脚本化场景。
 */
import {
  buildWeightNotify,
  CMD_TARE,
  CMD_TIMER,
  CMD_POWER_OFF,
  parseFrame,
  type ScaleEvent,
} from './frames'
import type { ConnectionState, DeviceInfo } from './scaleClient'

export interface SimScriptStep {
  /** 注水速率 g/s */
  rateGps: number
  /** 持续毫秒 */
  durMs: number
}

const TICK_MS = 100

export class ScaleSimulator {
  readonly isSimulator = true

  private connected = false
  private timer: ReturnType<typeof setInterval> | null = null
  private scriptTimer: ReturnType<typeof setInterval> | null = null
  /** 重量，0.1g 为单位避免浮点漂移 */
  private weightTenths = 0
  /** 注水速率 g/s */
  private pourRateGps = 0
  private simTimerRunning = false
  private simTimerStart = 0
  private simTimerBaseS = 0
  /** 上次 tick 真实时间：后台标签页 setInterval 被节流时按真实时间差推进，保证注水速率不失真 */
  private lastTickAt = 0
  private infoData: DeviceInfo = {
    bleName: 'TIMEMORE_Dot_SIM',
    modelNumber: 'TES017',
    manufacturer: 'TIMEMORE (仿真)',
    scaleName: '仿真秤',
    firmware: 'sim-1.0',
  }

  constructor(
    private onEvent: (e: ScaleEvent) => void,
    private onStateChange: (state: ConnectionState) => void = () => {},
  ) {}

  get isConnected() {
    return this.connected
  }

  get info(): DeviceInfo {
    return this.infoData
  }

  async connect(): Promise<void> {
    this.connected = true
    this.onStateChange('connected')
    this.emit({ type: 'battery', bars: 4, percent: 92 })
    this.lastTickAt = Date.now()
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  async reconnect(): Promise<void> {
    await this.connect()
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.pourRateGps = 0
    this.stopScript()
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.onStateChange('disconnected')
  }

  // ── 仿真控制 ─────────────────────────────────────────────────────────

  /** 设定注水速率 g/s（负值模拟取走重物） */
  setPourRate(gps: number): void {
    this.pourRateGps = gps
  }

  get currentPourRate(): number {
    return this.pourRateGps
  }

  /** 直接设定重量（模拟放容器等） */
  setWeight(g: number): void {
    this.weightTenths = Math.round(g * 10)
  }

  /** 播放注水脚本：按序以指定速率注水指定时长（时间戳驱动，节流下时长不失真） */
  playScript(steps: SimScriptStep[]): void {
    this.stopScript()
    let idx = 0
    let stepEndAt = 0
    this.scriptTimer = setInterval(() => {
      const now = Date.now()
      if (now < stepEndAt) return
      if (idx >= steps.length) {
        this.pourRateGps = 0
        this.stopScript()
        return
      }
      const step = steps[idx++]!
      this.pourRateGps = step.rateGps
      stepEndAt = now + step.durMs
    }, TICK_MS)
  }

  stopScript(): void {
    if (this.scriptTimer) {
      clearInterval(this.scriptTimer)
      this.scriptTimer = null
    }
  }

  // ── 命令（与真机一致的 ACK 行为） ──────────────────────────────────────

  async tare(): Promise<boolean> {
    this.weightTenths = 0
    this.emit({ type: 'writeAck', cmd: CMD_TARE, ok: true })
    return true
  }

  readBattery(): void {
    if (!this.connected) return
    this.emit({ type: 'battery', bars: 4, percent: 92 })
  }

  async timerStart(): Promise<boolean> {
    this.simTimerRunning = true
    this.simTimerStart = Date.now()
    this.emit({ type: 'timerState', state: 1 })
    this.emit({ type: 'writeAck', cmd: CMD_TIMER, ok: true })
    return true
  }

  async timerPause(): Promise<boolean> {
    this.simTimerBaseS += (Date.now() - this.simTimerStart) / 1000
    this.simTimerRunning = false
    this.emit({ type: 'timerState', state: 2 })
    this.emit({ type: 'writeAck', cmd: CMD_TIMER, ok: true })
    return true
  }

  async timerReset(): Promise<boolean> {
    this.simTimerRunning = false
    this.simTimerBaseS = 0
    this.emit({ type: 'timerState', state: 3 })
    this.emit({ type: 'writeAck', cmd: CMD_TIMER, ok: true })
    return true
  }

  async powerOff(): Promise<boolean> {
    this.emit({ type: 'writeAck', cmd: CMD_POWER_OFF, ok: true })
    await this.disconnect()
    return true
  }

  // ── 内部 ─────────────────────────────────────────────────────────────

  private tick(): void {
    const now = Date.now()
    // 真实时间差推进；上限 1s 防止标签页挂起后醒来时注入跳变
    const dtSec = Math.min(1, Math.max(0, (now - this.lastTickAt) / 1000))
    this.lastTickAt = now
    this.weightTenths += this.pourRateGps * dtSec * 10
    const timerS = this.simTimerRunning
      ? this.simTimerBaseS + (now - this.simTimerStart) / 1000
      : this.simTimerBaseS
    const bytes = buildWeightNotify(this.weightTenths / 10, this.pourRateGps, timerS)
    const event = parseFrame(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength))
    if (event) this.emit(event)
  }

  private emit(e: ScaleEvent): void {
    if (this.connected) this.onEvent(e)
  }
}
