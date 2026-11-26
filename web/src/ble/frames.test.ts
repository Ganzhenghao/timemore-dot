import { describe, expect, it } from 'vitest'
import {
  buildRead,
  buildWrite,
  FRAME_TARE,
  FRAME_TIMER_PAUSE,
  FRAME_TIMER_RESET,
  FRAME_TIMER_START,
  FRAME_KEEPALIVE_WRITE,
  parseFrame,
} from './frames'

const hex = (u8: Uint8Array) =>
  Array.from(u8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ')

/** 构造一帧 DataView */
const frame = (bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer)

describe('HCI 抓包字节快照', () => {
  // 来源：参考实现 timemore-dot-v3-30.html，官方 App 对真实 DOT 抓包
  it('去皮帧', () => {
    expect(hex(FRAME_TARE)).toBe('a5 5a 03 0d 00 02 00 00 00 71')
  })
  it('计时帧', () => {
    expect(hex(FRAME_TIMER_START)).toBe('a5 5a 03 02 00 01 01 00 20')
    expect(hex(FRAME_TIMER_PAUSE)).toBe('a5 5a 03 02 00 01 02 ff d0')
    expect(hex(FRAME_TIMER_RESET)).toBe('a5 5a 03 02 00 01 03 ff 81')
  })
  it('保活写帧', () => {
    expect(hex(FRAME_KEEPALIVE_WRITE)).toBe('a5 5a 03 08 00 02 01 00 00 25')
  })
})

describe('buildRead / buildWrite', () => {
  it('读命令 CRC 填 0000（官方 App 观测行为）', () => {
    expect(hex(buildRead(0x05))).toBe('a5 5a 02 05 00 00 00 00')
    expect(hex(buildRead(0x10))).toBe('a5 5a 02 10 00 00 00 00')
  })
  it('写命令按文档格式 + CRC 0000', () => {
    // 单位写 g：A5 5A 03 06 00 01 00 + CRC 0000
    expect(hex(buildWrite(0x06, [0x00]))).toBe('a5 5a 03 06 00 01 00 00 00')
    // 关机：A5 5A 03 0B 00 00 + CRC 0000
    expect(hex(buildWrite(0x0b))).toBe('a5 5a 03 0b 00 00 00 00')
  })
})

describe('parseFrame 重量通知', () => {
  // 文档示例帧：A5 5A 01 01 00 09 [Int32 BE 0.1g] [Int16 BE 0.1g/s] [Uint16 BE s] [overload] [CRC]
  const weightFrame = (w: number, flow: number, timer: number, overload = 0) =>
    frame([
      0xa5, 0x5a, 0x01, 0x01, 0x00, 0x09,
      (w >> 24) & 0xff, (w >> 16) & 0xff, (w >> 8) & 0xff, w & 0xff,
      (flow >> 8) & 0xff, flow & 0xff,
      (timer >> 8) & 0xff, timer & 0xff,
      overload,
      0x00, 0x00,
    ])

  it('解析重量/流速/计时/过载', () => {
    const e = parseFrame(weightFrame(1234, 23, 45))
    expect(e).toEqual({
      type: 'weight',
      weightG: 123.4,
      flowGps: 2.3,
      timerS: 45,
      overload: false,
    })
  })

  it('负重量（去皮后取走容器）', () => {
    // -500 (0.1g) = -50.0g，Int32 大端补码 FFFF FE0C
    const e = parseFrame(weightFrame(-500, 0, 0))
    expect(e && e.type === 'weight' ? e.weightG : null).toBe(-50)
  })

  it('满量程 3kg（Int32 无 int16 溢出问题）', () => {
    const e = parseFrame(weightFrame(30000, 0, 0))
    expect(e && e.type === 'weight' ? e.weightG : null).toBe(3000)
  })

  it('过载标志', () => {
    const e = parseFrame(weightFrame(0, 0, 0, 1))
    expect(e && e.type === 'weight' ? e.overload : null).toBe(true)
  })

  it('不依赖 length 字段（参考实现观测 DOT 长度字段疑似填 0）', () => {
    const bytes = [
      0xa5, 0x5a, 0x01, 0x01, 0x00, 0x00, // length 填 0000
      0x00, 0x00, 0x04, 0xd2, // 123.4g
      0x00, 0x17, // 2.3 g/s
      0x00, 0x2d, // 45 s
      0x00, 0x00, 0x00,
    ]
    const e = parseFrame(frame(bytes))
    expect(e).toEqual({
      type: 'weight',
      weightG: 123.4,
      flowGps: 2.3,
      timerS: 45,
      overload: false,
    })
  })

  it('短帧返回 null', () => {
    expect(parseFrame(frame([0xa5, 0x5a, 0x01, 0x01, 0x00]))).toBeNull()
    expect(parseFrame(frame([0x12, 0x34, 0x01, 0x01, 0x00, 0x09]))).toBeNull()
  })
})

describe('parseFrame 其他帧', () => {
  it('计时状态通知', () => {
    const e = parseFrame(frame([0xa5, 0x5a, 0x01, 0x02, 0x00, 0x01, 0x01, 0x00, 0x00]))
    expect(e).toEqual({ type: 'timerState', state: 1 })
  })

  it('电量通知', () => {
    const e = parseFrame(frame([0xa5, 0x5a, 0x01, 0x05, 0x00, 0x02, 0x03, 0x57, 0x00, 0x00]))
    expect(e).toEqual({ type: 'battery', bars: 3, percent: 87 })
  })

  it('电量读响应', () => {
    const e = parseFrame(frame([0xa5, 0x5a, 0x02, 0x05, 0x00, 0x02, 0x03, 0x57, 0x00, 0x00]))
    expect(e).toEqual({ type: 'battery', bars: 3, percent: 87 })
  })

  it('单位通知', () => {
    const e = parseFrame(frame([0xa5, 0x5a, 0x01, 0x06, 0x00, 0x01, 0x00, 0x00, 0x00]))
    expect(e).toEqual({ type: 'unit', unit: 0 })
  })

  it('写 ACK', () => {
    const ok = parseFrame(frame([0xa5, 0x5a, 0x03, 0x0d, 0x00, 0x01, 0x01, 0x00, 0x00]))
    const fail = parseFrame(frame([0xa5, 0x5a, 0x03, 0x0d, 0x00, 0x01, 0x00, 0x00, 0x00]))
    expect(ok).toEqual({ type: 'writeAck', cmd: 0x0d, ok: true })
    expect(fail).toEqual({ type: 'writeAck', cmd: 0x0d, ok: false })
  })

  it('设备名读响应（未知命令归 readResp）', () => {
    const e = parseFrame(
      frame([0xa5, 0x5a, 0x02, 0x0c, 0x00, 0x05, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x00]),
    )
    expect(e?.type).toBe('readResp')
    if (e?.type === 'readResp') {
      expect(e.cmd).toBe(0x0c)
      expect(new TextDecoder().decode(e.data)).toBe('Hello')
    }
  })

  it('计时读响应归类为 timerState', () => {
    const e = parseFrame(frame([0xa5, 0x5a, 0x02, 0x02, 0x00, 0x01, 0x02, 0x00, 0x00]))
    expect(e).toEqual({ type: 'timerState', state: 2 })
  })
})
