/**
 * 冲煮记录路由：分页查询、详情（含曲线 samples）、保存、更新备注评分、删除。
 */
import { Router } from 'express'

// 10Hz 一小时的上限，防异常写入
const MAX_SAMPLES = 36_000

export function brewRecordRoutes(dbm) {
  const r = Router()

  // 无副作用查询；筛选条件超过 3 个仍为简单等值匹配，保持 GET + query 传参
  r.get('/brewRecord/pageQuery', async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1)
    const size = Math.min(50, Math.max(1, Number(req.query.size) || 10))
    const where = []
    const params = []
    if (req.query.mode) {
      where.push('mode = ?')
      params.push(String(req.query.mode))
    }
    if (req.query.planId) {
      where.push('planId = ?')
      params.push(Number(req.query.planId))
    }
    if (req.query.startDate) {
      where.push('startedAt >= ?')
      params.push(Number(req.query.startDate))
    }
    if (req.query.endDate) {
      where.push('startedAt <= ?')
      params.push(Number(req.query.endDate))
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const totalRows = await dbm.db.query(`SELECT COUNT(*) AS c FROM brew_record ${whereSql}`, params)
    const rows = await dbm.db.query(
      `SELECT id, mode, planId, startedAt, endedAt, durationMs, coffeeWeight, waterTotal, peakFlow, avgFlow, deviceName, rating, notes
       FROM brew_record ${whereSql} ORDER BY startedAt DESC LIMIT ? OFFSET ?`,
      [...params, size, (page - 1) * size],
    )
    res.json({ ok: true, data: { total: totalRows[0]?.c ?? 0, page, size, list: rows } })
  })

  r.get('/brewRecord/getById/:id', async (req, res) => {
    const rows = await dbm.db.query('SELECT * FROM brew_record WHERE id=?', [Number(req.params.id)])
    const row = rows[0]
    if (!row) return res.status(404).json({ ok: false, error: '记录不存在' })
    res.json({ ok: true, data: { ...row, samples: JSON.parse(row.samples ?? 'null') } })
  })

  r.post('/brewRecord/save', async (req, res) => {
    try {
      const b = req.body ?? {}
      if (b.mode !== 'pour' && b.mode !== 'standard') throw new Error('mode 无效')
      const samples = validateSamples(b.samples)
      const r2 = await dbm.db.execute(
        `INSERT INTO brew_record (mode, planId, startedAt, endedAt, durationMs, coffeeWeight, waterTotal, peakFlow, avgFlow, deviceName, rating, notes, samples)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          b.mode,
          b.planId ? Number(b.planId) : null,
          reqNum(b.startedAt, 'startedAt'),
          intOrNull(b.endedAt),
          intOrNull(b.durationMs),
          numOrNull(b.coffeeWeight),
          numOrNull(b.waterTotal),
          numOrNull(b.peakFlow),
          numOrNull(b.avgFlow),
          b.deviceName ? String(b.deviceName).slice(0, 64) : null,
          b.rating != null ? Math.min(5, Math.max(1, Math.round(Number(b.rating)))) : null,
          b.notes ? String(b.notes).slice(0, 2000) : null,
          samples ? JSON.stringify(samples) : null,
        ],
      )
      res.json({ ok: true, data: { id: r2.insertId } })
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message })
    }
  })

  r.post('/brewRecord/update/:id', async (req, res) => {
    const b = req.body ?? {}
    const rating = b.rating == null ? null : Math.min(5, Math.max(1, Math.round(Number(b.rating))))
    if (rating === null && b.notes === undefined) {
      return res.status(400).json({ ok: false, error: '没有可更新字段' })
    }
    await dbm.db.execute('UPDATE brew_record SET rating=?, notes=? WHERE id=?', [
      rating,
      b.notes !== undefined ? String(b.notes).slice(0, 2000) : null,
      Number(req.params.id),
    ])
    res.json({ ok: true, data: {} })
  })

  r.post('/brewRecord/delete/:id', async (req, res) => {
    await dbm.db.execute('DELETE FROM brew_record WHERE id=?', [Number(req.params.id)])
    res.json({ ok: true, data: {} })
  })

  return r
}

function validateSamples(samples) {
  if (samples === undefined || samples === null) return null
  if (typeof samples !== 'object') throw new Error('samples 格式无效')
  const { t, w, f } = samples
  if (!Array.isArray(t) || !Array.isArray(w) || !Array.isArray(f)) throw new Error('samples 需含 t/w/f 数组')
  if (t.length !== w.length || t.length !== f.length) throw new Error('samples 数组长度不一致')
  if (t.length > MAX_SAMPLES) throw new Error(`samples 超过上限 ${MAX_SAMPLES}`)
  for (const v of t) {
    if (!Number.isFinite(v)) throw new Error('samples.t 含非数值')
  }
  return { t, w, f }
}

const reqNum = (v, name) => {
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`${name} 无效`)
  return n
}
const numOrNull = (v) => {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const intOrNull = (v) => {
  const n = numOrNull(v)
  return n === null ? null : Math.round(n)
}
