/**
 * 冲煮计划路由。计划步骤以 JSON 存 steps 列，整体读写。
 */
import { Router } from 'express'

export function brewPlanRoutes(dbm) {
  const r = Router()

  r.get('/brewPlan/list', async (req, res) => {
    const rows = await dbm.db.query('SELECT * FROM brew_plan ORDER BY updatedAt DESC')
    res.json({ ok: true, data: rows.map(parsePlan) })
  })

  r.post('/brewPlan/save', async (req, res) => {
    try {
      const plan = validatePlan(req.body)
      const now = Date.now()
      if (plan.id) {
        await dbm.db.execute(
          'UPDATE brew_plan SET name=?, coffeeWeight=?, ratio=?, steps=?, updatedAt=? WHERE id=?',
          [plan.name, plan.coffeeWeight, plan.ratio, plan.stepsJson, now, plan.id],
        )
        res.json({ ok: true, data: { id: plan.id } })
      } else {
        const r2 = await dbm.db.execute(
          'INSERT INTO brew_plan (name, coffeeWeight, ratio, steps, createdAt, updatedAt) VALUES (?,?,?,?,?,?)',
          [plan.name, plan.coffeeWeight, plan.ratio, plan.stepsJson, now, now],
        )
        res.json({ ok: true, data: { id: r2.insertId } })
      }
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message })
    }
  })

  r.post('/brewPlan/delete/:id', async (req, res) => {
    await dbm.db.execute('DELETE FROM brew_plan WHERE id=?', [Number(req.params.id)])
    res.json({ ok: true, data: {} })
  })

  return r
}

function parsePlan(row) {
  return {
    ...row,
    steps: JSON.parse(row.steps ?? '[]'),
    stepsJson: undefined,
  }
}

export function validatePlan(body) {
  const name = String(body?.name ?? '').trim()
  if (!name || name.length > 64) throw new Error('计划名称必填（1-64 字符）')
  const steps = body?.steps
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('至少需要一个步骤')
  let prevEnd = null
  let prevTarget = 0
  for (const s of steps) {
    if (s.type !== 'pour' && s.type !== 'pause') throw new Error(`步骤类型必须为 pour 或 pause`)
    const startS = Number(s.startS)
    const endS = Number(s.endS)
    if (!Number.isFinite(startS) || !Number.isFinite(endS) || startS < 0 || endS <= startS) {
      throw new Error('步骤起止时间无效（需 ≥0 且 endS > startS）')
    }
    if (prevEnd !== null && startS < prevEnd) throw new Error('步骤时间区间有重叠')
    if (s.type === 'pour') {
      const targetG = Number(s.targetG)
      if (!Number.isFinite(targetG) || targetG <= prevTarget) {
        throw new Error('注水步骤的目标克重必须递增')
      }
      prevTarget = targetG
    }
    if (s.label !== undefined && String(s.label).length > 32) throw new Error('步骤标签过长')
    prevEnd = endS
  }
  return {
    id: body.id ? Number(body.id) : null,
    name,
    coffeeWeight: numOrNull(body.coffeeWeight),
    ratio: numOrNull(body.ratio),
    stepsJson: JSON.stringify(steps.map((s) => ({
      type: s.type,
      label: s.label ? String(s.label) : undefined,
      startS: Number(s.startS),
      endS: Number(s.endS),
      targetG: s.type === 'pour' ? Number(s.targetG) : undefined,
    }))),
  }
}

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
