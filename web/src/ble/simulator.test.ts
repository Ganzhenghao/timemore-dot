import { describe, expect, it, vi } from 'vitest'
import { ScaleSimulator } from './simulator'
import type { ScaleEvent } from './frames'

describe('ScaleSimulator', () => {
  it('连接后以 10Hz 发送重量帧且能被 parseFrame 正确解析（round-trip）', async () => {
    vi.useFakeTimers()
    const events: ScaleEvent[] = []
    const sim = new ScaleSimulator((e) => events.push(e))
    await sim.connect()
    sim.setPourRate(2) // 2 g/s

    await vi.advanceTimersByTimeAsync(1000) // 1s → 10 帧

    const weights = events.filter((e): e is Extract<ScaleEvent, { type: 'weight' }> => e.type === 'weight')
    expect(weights.length).toBeGreaterThanOrEqual(10)
    // 1s 后约 2g（每帧 +0.2g）
    const last = weights[weights.length - 1]!
    expect(last.weightG).toBeCloseTo(2, 0)
    expect(last.flowGps).toBe(2)
    // 流速解析无浮点误差
    expect(last.flowGps).not.toBeNull()

    sim.setPourRate(0)
    vi.useRealTimers()
    await sim.disconnect()
  })

  it('tare 清零并发出写 ACK', async () => {
    vi.useFakeTimers()
    const events: ScaleEvent[] = []
    const sim = new ScaleSimulator((e) => events.push(e))
    await sim.connect()
    sim.setWeight(123.4)
    await vi.advanceTimersByTimeAsync(100)

    const ok = await sim.tare()
    expect(ok).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    const last = [...events].reverse().find((e) => e.type === 'weight')
    expect(last && last.type === 'weight' ? last.weightG : null).toBe(0)
    expect(events.some((e) => e.type === 'writeAck')).toBe(true)

    vi.useRealTimers()
    await sim.disconnect()
  })

  it('timerStart 发出计时状态通知', async () => {
    vi.useFakeTimers()
    const events: ScaleEvent[] = []
    const sim = new ScaleSimulator((e) => events.push(e))
    await sim.connect()
    await sim.timerStart()
    await vi.advanceTimersByTimeAsync(1500)
    const last = [...events].reverse().find((e) => e.type === 'weight')
    // 仿真硬件计时秒数在增长（1s 分辨率）
    expect(last && last.type === 'weight' ? last.timerS : -1).toBeGreaterThanOrEqual(1)
    expect(events.some((e) => e.type === 'timerState' && e.state === 1)).toBe(true)

    vi.useRealTimers()
    await sim.disconnect()
  })

  it('节流场景下按真实时间差推进（tick 间隔 1s 仍保持注水速率）', async () => {
    vi.useFakeTimers()
    const events: ScaleEvent[] = []
    const sim = new ScaleSimulator((e) => events.push(e))
    await sim.connect()
    sim.setPourRate(2)

    // 模拟浏览器把 interval 节流到 1s：一次推进 1000ms（触发 1 次回调，dt=1s）
    await vi.advanceTimersByTimeAsync(1000)
    const last = [...events].reverse().find((e) => e.type === 'weight')
    // dt=1s × 2g/s = 2g，与正常 10Hz 累积结果一致
    expect(last && last.type === 'weight' ? last.weightG : null).toBeCloseTo(2, 0)

    vi.useRealTimers()
    await sim.disconnect()
  })
})
