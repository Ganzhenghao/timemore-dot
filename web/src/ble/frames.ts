/**
 * Timemore Black Mirror SCALE BLE 协议（v1.0.3）帧构建与解析。
 * 仅适配 Timemore DOT（TES017）。
 *
 * 帧格式: A5 5A | opcode | cmd | length(2B 大端) | payload | CRC(2B)
 *
 * CRC 字段经 scripts/verify-crc.mjs 验证：官方 App 读命令一律填 0000，
 * 写命令尾字节为 HCI 抓包固定观测值、不可由任何标准 CRC-16 算法推导
 * （poly 0x8005 init 0xFFFF 两种反射变体、覆盖范围变体、全 poly 暴力枚举均无解），
 * 且文档标注 "CRC field reserved" —— 判定设备不校验 CRC。
 * 因此：5 条已验证写命令用字面字节，其余读写命令 CRC 填 0000。
 * 真机若有异常，调整点集中在本地。
 */

/** 操作码：0x01 通知 / 0x02 读 / 0x03 写 */
export const OP_NOTIFY = 0x01
export const OP_READ = 0x02
export const OP_WRITE = 0x03

/** 命令字 */
export const CMD_WEIGHT = 0x01 // 重量/流速/计时，100ms 通知
export const CMD_TIMER = 0x02 // 计时状态 1 开始 / 2 暂停 / 3 重置
export const CMD_BATTERY = 0x05 // 电量 格数 + 百分比
export const CMD_UNIT = 0x06 // 单位 0=g 1=oz
export const CMD_POWER_OFF = 0x0b
export const CMD_DEVICE_NAME = 0x0c
export const CMD_TARE = 0x0d
export const CMD_FIRMWARE = 0x10
/** 未见于 v1.0.3 文档：官方 App 每 10s 写 0x08 保活，参考实现验证为 HW 命令被接受的前提 */
export const CMD_KEEPALIVE = 0x08
/** 未见于文档：官方 App 初始化序列中读取（疑似型号/状态查询），无害保留 */
export const CMD_INIT13 = 0x13

/** GATT UUID */
export const UUID_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb'
export const UUID_NOTIFY_CHAR = '0000fff1-0000-1000-8000-00805f9b34fb'
export const UUID_WRITE_CHAR = '0000fff2-0000-1000-8000-00805f9b34fb'
export const UUID_DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb'
export const UUID_MODEL_NUMBER = '00002a24-0000-1000-8000-00805f9b34fb'
export const UUID_FIRMWARE_REVISION = '00002a26-0000-1000-8000-00805f9b34fb'
export const UUID_MANUFACTURER = '00002a29-0000-1000-8000-00805f9b34fb'

/** DOT 型号标识（Device Information Service 读取值） */
export const DOT_MODEL_NUMBER = 'TES017'

// ── HCI 抓包验证的写命令字面字节（尾 2 字节为官方 App 观测 CRC 值）─────────────

export const FRAME_TARE = /* 10 字节：文档为 8 字节 length=0 版本，但官方 App 实际发送带 2 字节 payload */
  Uint8Array.from([0xa5, 0x5a, 0x03, 0x0d, 0x00, 0x02, 0x00, 0x00, 0x00, 0x71])

export const FRAME_TIMER_START =
  Uint8Array.from([0xa5, 0x5a, 0x03, 0x02, 0x00, 0x01, 0x01, 0x00, 0x20])
/** 计时暂停（协议 0x02 = pause） */
export const FRAME_TIMER_PAUSE =
  Uint8Array.from([0xa5, 0x5a, 0x03, 0x02, 0x00, 0x01, 0x02, 0xff, 0xd0])
export const FRAME_TIMER_RESET =
  Uint8Array.from([0xa5, 0x5a, 0x03, 0x02, 0x00, 0x01, 0x03, 0xff, 0x81])

/** 保活写命令（cmd 0x08，文档未载，官方 App 每 10s 发送） */
export const FRAME_KEEPALIVE_WRITE =
  Uint8Array.from([0xa5, 0x5a, 0x03, 0x08, 0x00, 0x02, 0x01, 0x00, 0x00, 0x25])

// ── 帧构建（CRC 填 0000，见文件头注释）───────────────────────────────────────

/** 读查询帧：A5 5A 02 [cmd] 00 00 00 00 */
export function buildRead(cmd: number): Uint8Array<ArrayBuffer> {
  return Uint8Array.from([0xa5, 0x5a, OP_READ, cmd, 0x00, 0x00, 0x00, 0x00])
}

/** 写命令帧：A5 5A 03 [cmd] [len] [payload] 00 00 */
export function buildWrite(cmd: number, payload: number[] = []): Uint8Array<ArrayBuffer> {
  const head = [0xa5, 0x5a, OP_WRITE, cmd, (payload.length >> 8) & 0xff, payload.length & 0xff]
  return Uint8Array.from([...head, ...payload, 0x00, 0x00])
}

/** 构建重量通知帧（供仿真设备与测试使用，真机由秤下发） */
export function buildWeightNotify(weightG: number, flowGps: number, timerS: number, overload = false): Uint8Array<ArrayBuffer> {
  const w = Math.round(weightG * 10) & 0xffffffff
  const flow = Math.round(flowGps * 10) & 0xffff
  const timer = Math.max(0, Math.min(3599, Math.round(timerS))) & 0xffff
  return Uint8Array.from([
    0xa5, 0x5a, OP_NOTIFY, CMD_WEIGHT, 0x00, 0x09,
    (w >>> 24) & 0xff, (w >>> 16) & 0xff, (w >>> 8) & 0xff, w & 0xff,
    (flow >>> 8) & 0xff, flow & 0xff,
    (timer >>> 8) & 0xff, timer & 0xff,
    overload ? 1 : 0,
    0x00, 0x00,
  ])
}

// ── 解析 ─────────────────────────────────────────────────────────────────────

export type ScaleEvent =
  | {
      type: 'weight'
      /** 重量 g（0.1g 分辨率） */
      weightG: number
      /** 流速 g/s（秤上报，0.1g/s 分辨率；0-999 即 0-99.9 g/s） */
      flowGps: number
      /** 秤硬件计时秒数（1s 分辨率，UI 计时以软件为准） */
      timerS: number
      overload: boolean
    }
  | { type: 'timerState'; state: 1 | 2 | 3 }
  | { type: 'battery'; bars: number; percent: number }
  | { type: 'unit'; unit: 0 | 1 }
  | { type: 'readResp'; cmd: number; data: Uint8Array }
  | { type: 'writeAck'; cmd: number; ok: boolean }

/**
 * 解析一帧。通知帧的 length 字段可能为 0，因此重量类通知按固定偏移取值；
 * 读写响应按 length 字段截取 payload，避免把后续帧内容算进当前字段。
 * 接收端不校验 CRC（文档 reserved）。无法识别返回 null。
 */
export function parseFrame(view: DataView): ScaleEvent | null {
  if (view.byteLength < 6) return null
  if (view.getUint8(0) !== 0xa5 || view.getUint8(1) !== 0x5a) return null
  const opcode = view.getUint8(2)
  const cmd = view.getUint8(3)

  if (opcode === OP_NOTIFY) {
    switch (cmd) {
      case CMD_WEIGHT:
        return parseWeight(view)
      case CMD_TIMER:
        return { type: 'timerState', state: view.getUint8(6) as 1 | 2 | 3 }
      case CMD_BATTERY:
        return { type: 'battery', bars: view.getUint8(6), percent: view.getUint8(7) }
      case CMD_UNIT:
        return { type: 'unit', unit: (view.getUint8(6) & 1) as 0 | 1 }
      default:
        return null
    }
  }

  // 读响应 / 写 ACK：length 字段只计算 payload，CRC 固定占最后 2 字节
  const payloadLength = view.getUint16(4, false)
  const payloadEnd = Math.min(6 + payloadLength, Math.max(6, view.byteLength - 2))
  const data = new Uint8Array(view.buffer, view.byteOffset + 6, Math.max(0, payloadEnd - 6))

  if (opcode === OP_READ) {
    // 已知命令归类，未知（设备名/固件/0x13/0x08 等）交给 readResp 由调用方解析
    switch (cmd) {
      case CMD_TIMER:
        return { type: 'timerState', state: data[0] as 1 | 2 | 3 }
      case CMD_BATTERY:
        return { type: 'battery', bars: data[0], percent: data[1] }
      case CMD_UNIT:
        return { type: 'unit', unit: (data[0] & 1) as 0 | 1 }
      default:
        return { type: 'readResp', cmd, data }
    }
  }

  if (opcode === OP_WRITE) {
    return { type: 'writeAck', cmd, ok: data[0] === 0x01 }
  }

  return null
}

/**
 * 解析一次 BLE characteristic value 中可能串联的多帧。
 * 读写响应依赖 length 计算下一帧边界；通知帧长度字段异常时使用协议固定长度。
 */
export function parseFrames(view: DataView): ScaleEvent[] {
  const events: ScaleEvent[] = []
  let offset = 0

  while (offset + 6 <= view.byteLength) {
    const remaining = new DataView(view.buffer, view.byteOffset + offset, view.byteLength - offset)
    if (remaining.getUint8(0) !== 0xa5 || remaining.getUint8(1) !== 0x5a) break

    const event = parseFrame(remaining)
    if (event) events.push(event)

    const frameLength = getFrameLength(remaining, event)
    if (frameLength <= 0 || frameLength > remaining.byteLength) break
    offset += frameLength
  }

  return events
}

function getFrameLength(view: DataView, event: ScaleEvent | null): number {
  if (view.byteLength < 6) return 0

  const opcode = view.getUint8(2)
  if (opcode === OP_NOTIFY) {
    const cmd = view.getUint8(3)
    if (cmd === CMD_WEIGHT) return 17
    if (cmd === CMD_TIMER || cmd === CMD_UNIT) return 9
    if (cmd === CMD_BATTERY) return 10
  }

  const payloadLength = view.getUint16(4, false)
  const frameLength = 6 + payloadLength + 2
  return event && frameLength >= 8 ? frameLength : 0
}

function parseWeight(view: DataView): ScaleEvent | null {
  // 需要至少覆盖 Int32 重量字段（偏移 6..9）
  if (view.byteLength < 10) return null
  const weightG = view.getInt32(6, false) / 10
  // 除法避免 * 0.1 的浮点误差（23/10===2.3 而 23*0.1 为 2.3000...3）
  const flowGps = view.byteLength >= 12 ? view.getInt16(10, false) / 10 : 0
  const timerS = view.byteLength >= 14 ? view.getUint16(12, false) : 0
  const overload = view.byteLength >= 15 ? view.getUint8(14) === 1 : false
  return { type: 'weight', weightG, flowGps, timerS, overload }
}
