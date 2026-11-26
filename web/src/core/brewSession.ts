/**
 * 手冲冲煮会话状态机：计时（手动/自动注水触发）、采样缓冲、流速平滑、
 * 计划跟踪与保存载荷组装。纯逻辑，时间由调用方注入便于测试。
 *
 * 状态流转:
 *   idle ──arm()──> arming(3s 倒计时) ──> armed(等待注水) ──注水──> running
 *   idle ──startTimer()(手动)──> running
 *   running ──pauseTimer()──> paused ──resume──> running
 *   running/paused ──stop()──> stopped
 *   stopped ──reset()──> idle（保存由调用方在 reset 前处理）
 */

export type SessionState = 'idle' | 'arming' | 'armed' | 'running' | 'paused' | 'stopped'

export interface SessionSample {
  /** 相对计时开始的毫秒 */
  t: number
  /** 重量 g */
  w: number
  /** 流速 g/s */
  f: number
}

export interface SavePayload {
  mode: 'pour'
  planId: number | null
  startedAt: number
  endedAt: number
  durationMs: number
  coffeeWeight: number | null
  waterTotal: number
  peakFlow: number
  avgFlow: number
  deviceName: string
  samples: { t: number[]; w: number[]; f: number[] }
}

export interface BrewSessionConfig {
  /** 预备倒计时毫秒（自动计时用） */
  armDelayMs: number
  /** 注水检测阈值 g */
  pourThresholdG: number
}

const DEFAULT_CONFIG: BrewSessionConfig = { armDelayMs: 3000, pourThresholdG: 1 }

/** 是否值得保存为记录（时长过短或无注水则丢弃） */
const MIN_SAVE_MS = 5_000

export class BrewSession {
  state: SessionState = 'idle'
  config: BrewSessionConfig
  samples: SessionSample[] = []
  /** 计划关联 */
  planId: number | null = null
  /** 手动模式/计划模式统一记录粉量 */
  coffeeWeight: number | null = null

  private armedAtMs = 0
  private armBaselineG = 0
  private timerStartedAt = 0
  private accumulatedMs = 0
  private endedAt = 0
  private maxWeightG = 0
  private peakFlowGps = 0
  private flowSum = 0
  private flowCount = 0
  private firstSampleAt = 0

  constructor(config: Partial<BrewSessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 预备（自动计时模式）：进入 3s 倒计时后待注水 */
  arm(nowMs: number, currentWeightG: number): void {
    if (this.state !== 'idle') return
    this.state = 'arming'
    this.armedAtMs = nowMs
    this.armBaselineG = currentWeightG
  }

  cancelArm(): void {
    if (this.state === 'arming' || this.state === 'armed') this.state = 'idle'
  }

  startTimer(nowMs: number): void {
    if (this.state === 'running') return
    if (this.state === 'paused') return this.resume(nowMs)
    if (this.state !== 'idle' && this.state !== 'armed') return
    this.state = 'running'
    this.timerStartedAt = nowMs
    this.accumulatedMs = 0
    this.firstSampleAt = nowMs
  }

  pauseTimer(nowMs: number): void {
    if (this.state !== 'running') return
    this.accumulatedMs += nowMs - this.timerStartedAt
    this.state = 'paused'
  }

  resume(nowMs: number): void {
    if (this.state !== 'paused') return
    this.timerStartedAt = nowMs
    this.state = 'running'
  }

  stop(nowMs: number): void {
    if (this.state === 'running') {
      this.accumulatedMs += nowMs - this.timerStartedAt
    }
    if (this.state !== 'running' && this.state !== 'paused') return
    this.state = 'stopped'
    this.endedAt = nowMs
  }

  reset(): void {
    this.state = 'idle'
    this.samples = []
    this.planId = null
    this.coffeeWeight = null
    this.accumulatedMs = 0
    this.maxWeightG = 0
    this.peakFlowGps = 0
    this.flowSum = 0
    this.flowCount = 0
    this.armBaselineG = 0
  }

  /** 当前计时毫秒（显示用） */
  elapsedMs(nowMs: number): number {
    if (this.state === 'running') return this.accumulatedMs + (nowMs - this.timerStartedAt)
    if (this.state === 'paused' || this.state === 'stopped') return this.accumulatedMs
    return 0
  }

  /** 预备倒计时剩余毫秒（非 arming 状态为 0） */
  armingRemainMs(nowMs: number): number {
    if (this.state !== 'arming') return 0
    return Math.max(0, this.armedAtMs + this.config.armDelayMs - nowMs)
  }

  /** 是否可保存为历史记录 */
  isSavable(): boolean {
    return this.samples.length > 0 && this.accumulatedMs >= MIN_SAVE_MS
  }

  /**
   * 输入一帧显示重量。
   * armed 状态下重量越过基线阈值自动开始计时（自动注水计时）。
   */
  onSample(nowMs: number, weightG: number, flowGps: number): void {
    if (this.state === 'arming' && nowMs - this.armedAtMs >= this.config.armDelayMs) {
      this.state = 'armed'
      this.armBaselineG = weightG // 倒计时结束重新快照基线，排除预备期间放置容器的干扰
    }
    if (this.state === 'armed' && weightG >= this.armBaselineG + this.config.pourThresholdG) {
      this.startTimer(nowMs)
    }
    if (this.state === 'running') {
      const t = this.accumulatedMs + (nowMs - this.timerStartedAt)
      this.samples.push({ t: Math.round(t), w: Math.round(weightG * 10) / 10, f: Math.round(flowGps * 10) / 10 })
      if (weightG > this.maxWeightG) this.maxWeightG = weightG
      if (flowGps > this.peakFlowGps) this.peakFlowGps = flowGps
      this.flowSum += flowGps
      this.flowCount++
    }
  }

  get waterTotalG(): number {
    return this.maxWeightG
  }

  get peakFlow(): number {
    return this.peakFlowGps
  }

  get avgFlow(): number {
    return this.flowCount > 0 ? this.flowSum / this.flowCount : 0
  }

  /** 组装保存载荷（0.1g / 0.1g/s 整数数组压缩体积） */
  buildSavePayload(deviceName: string): SavePayload {
    const durationMs = Math.round(this.accumulatedMs)
    return {
      mode: 'pour',
      planId: this.planId,
      startedAt: this.firstSampleAt,
      endedAt: this.endedAt || this.firstSampleAt + durationMs,
      durationMs,
      coffeeWeight: this.coffeeWeight,
      waterTotal: Math.round(this.maxWeightG * 10) / 10,
      peakFlow: Math.round(this.peakFlowGps * 10) / 10,
      avgFlow: Math.round(this.avgFlow * 10) / 10,
      deviceName,
      samples: {
        t: this.samples.map((s) => s.t),
        w: this.samples.map((s) => Math.round(s.w * 10)),
        f: this.samples.map((s) => Math.round(s.f * 10)),
      },
    }
  }
}
