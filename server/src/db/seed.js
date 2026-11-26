/**
 * 新库首次建表时写入的默认数据。
 * 仅在建表时执行一次；已有库不会补写，用户删除后也不会在下次启动恢复。
 * 步骤需与 web/src/core/planModel.ts 的 defaultPlan() 保持一致。
 */
export const DEFAULT_BREW_PLAN = {
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

export async function seedDefaultPlan(db) {
  const now = Date.now()
  await db.execute(
    'INSERT INTO brew_plan (name, coffeeWeight, ratio, steps, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
    [DEFAULT_BREW_PLAN.name, DEFAULT_BREW_PLAN.coffeeWeight, DEFAULT_BREW_PLAN.ratio, JSON.stringify(DEFAULT_BREW_PLAN.steps), now, now],
  )
}
