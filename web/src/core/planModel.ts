/**
 * 冲煮计划模型：步骤定义、校验、目标曲线计算、步骤定位。
 * 目标曲线纵轴为注水量（g），从 0 开始累积。
 */

export interface PlanStep {
  type: 'pour' | 'pause'
  /** 步骤标签，如 闷蒸/第二段/结束萃取 */
  label?: string
  startS: number
  endS: number
  /** 注水步骤的目标注水总量 g（递增） */
  targetG?: number
}

export interface BrewPlan {
  id?: number
  name: string
  coffeeWeight?: number | null
  ratio?: number | null
  steps: PlanStep[]
  createdAt?: number
  updatedAt?: number
}

/**
 * 校验步骤列表，返回 null 表示合法，否则返回错误信息。
 * 规则：非空、按 startS 升序、区间不重叠、endS > startS ≥ 0、
 * 注水步骤 targetG 必填且严格递增。
 */
export function validateSteps(steps: PlanStep[]): string | null {
  if (!Array.isArray(steps) || steps.length === 0) return '至少需要一个步骤'
  let prevEnd: number | null = null
  let prevTarget = 0
  for (const s of steps) {
    if (s.type !== 'pour' && s.type !== 'pause') return '步骤类型必须为 注水 或 停顿'
    const { startS, endS } = s
    if (!Number.isFinite(startS) || !Number.isFinite(endS) || startS < 0 || endS <= startS) {
      return '步骤起止时间无效：需 startS ≥ 0 且 endS > startS'
    }
    if (prevEnd !== null && startS < prevEnd) return '步骤时间区间有重叠'
    if (s.type === 'pour') {
      if (!Number.isFinite(s.targetG) || (s.targetG ?? 0) <= prevTarget) {
        return '注水步骤的目标克重必须递增'
      }
      prevTarget = s.targetG!
    }
    prevEnd = endS
  }
  return null
}

/** 计划总时长（秒） */
export function planDurationS(steps: PlanStep[]): number {
  return steps.reduce((m, s) => Math.max(m, s.endS), 0)
}

export interface CurvePoint {
  tS: number
  wG: number
}

/**
 * 目标注水曲线：注水步骤线性爬升到目标，停顿水平。
 * 返回折线点序列（含 t=0 起点）。
 */
export function targetCurve(steps: PlanStep[]): CurvePoint[] {
  const pts: CurvePoint[] = [{ tS: 0, wG: 0 }]
  let level = 0
  for (const s of steps) {
    if (s.type === 'pour') {
      pts.push({ tS: s.startS, wG: level })
      level = s.targetG ?? level
      pts.push({ tS: s.endS, wG: level })
    } else {
      pts.push({ tS: s.startS, wG: level })
      pts.push({ tS: s.endS, wG: level })
    }
  }
  return pts
}

/** 时刻 tS 处的目标注水量（g），线性插值 */
export function targetAt(steps: PlanStep[], tS: number): number {
  const curve = targetCurve(steps)
  if (tS <= 0) return 0
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]!
    const b = curve[i]!
    if (tS <= b.tS) {
      if (b.tS === a.tS) return b.wG
      const r = (tS - a.tS) / (b.tS - a.tS)
      return a.wG + r * (b.wG - a.wG)
    }
  }
  return curve[curve.length - 1]!.wG
}

/** 定位当前与下一步骤；tS 超出计划范围时 current 为 null、done 为 true */
export function stepAt(
  steps: PlanStep[],
  tS: number,
): { current: PlanStep | null; next: PlanStep | null; done: boolean } {
  let current: PlanStep | null = null
  let next: PlanStep | null = null
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!
    if (tS >= s.startS && tS < s.endS) {
      current = s
      next = steps[i + 1] ?? null
      return { current, next, done: false }
    }
  }
  // 计划间隙（步骤之间的空档）或结束后：找到下一个未开始的步骤
  for (const s of steps) {
    if (tS < s.startS) {
      return { current: null, next: s, done: false }
    }
  }
  return { current: null, next: null, done: true }
}

/** 默认模板：示例中的三段式 */
export function defaultPlan(): BrewPlan {
  return {
    name: '经典三段式',
    coffeeWeight: 15,
    ratio: 16,
    steps: [
      { type: 'pour', label: '第一段注水', startS: 0, endS: 10, targetG: 45 },
      { type: 'pause', label: '闷蒸', startS: 10, endS: 30 },
      { type: 'pour', label: '第二段注水', startS: 30, endS: 45, targetG: 120 },
      { type: 'pause', label: '停顿', startS: 45, endS: 55 },
      { type: 'pour', label: '第三段注水', startS: 55, endS: 70, targetG: 240 },
      { type: 'pause', label: '结束萃取', startS: 105, endS: 130 },
    ],
  }
}

/** 秒 → mm:ss */
export function formatClock(s: number): string {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}
