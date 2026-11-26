/**
 * API 集成测试（node:test）：SQLite 临时库全流程。
 * MySQL 侧需真实实例，由用户在设置页实测；此处不以 SQLite 结果推断其兼容性。
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createApp } from '../src/index.js'

const tmp = mkdtempSync(path.join(tmpdir(), 'timemore-test-'))
const { app, dbm } = await createApp({
  type: 'sqlite',
  sqlite: { file: path.join(tmp, 'test.db') },
})

const server = app.listen(0, '127.0.0.1')
await new Promise((r) => server.once('listening', r))
const base = `http://127.0.0.1:${server.address().port}`

after(async () => {
  server.close()
  await dbm.db.close()
  rmSync(tmp, { recursive: true, force: true })
})

const post = async (url, body) =>
  fetch(base + url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json())
const get = async (url) => fetch(base + url).then((r) => r.json())

const PLAN = {
  name: '经典三段式',
  coffeeWeight: 15,
  ratio: 16,
  steps: [
    { type: 'pour', label: '闷蒸注水', startS: 0, endS: 10, targetG: 45 },
    { type: 'pause', label: '闷蒸', startS: 10, endS: 30 },
    { type: 'pour', label: '第二段', startS: 30, endS: 45, targetG: 120 },
    { type: 'pause', label: '停顿', startS: 45, endS: 55 },
    { type: 'pour', label: '第三段', startS: 55, endS: 70, targetG: 240 },
    { type: 'pause', label: '结束萃取', startS: 105, endS: 130 },
  ],
}

test('健康检查', async () => {
  const r = await get('/api/health')
  assert.equal(r.ok, true)
  assert.equal(r.data.db, 'sqlite')
})

test('数据库 current 脱敏', async () => {
  const r = await get('/api/database/current')
  assert.equal(r.ok, true)
  assert.equal(r.data.type, 'sqlite')
  // 响应中不允许出现密码字段
  assert.equal('password' in (r.data.mysql ?? {}), false)
  assert.equal(JSON.stringify(r).includes('password'), false)
})

test('计划：保存 → 列表 → 删除', async () => {
  const saved = await post('/api/brewPlan/save', PLAN)
  assert.equal(saved.ok, true)
  const id = saved.data.id

  const list = await get('/api/brewPlan/list')
  assert.equal(list.ok, true)
  const found = list.data.find((p) => p.id === id)
  assert.ok(found)
  assert.equal(found.name, '经典三段式')
  assert.equal(found.steps.length, 6)
  assert.equal(found.steps[0].targetG, 45)

  // 更新
  const upd = await post('/api/brewPlan/save', { ...PLAN, id, name: '改名' })
  assert.equal(upd.ok, true)
  const list2 = await get('/api/brewPlan/list')
  assert.equal(list2.data.find((p) => p.id === id).name, '改名')

  const del = await post(`/api/brewPlan/delete/${id}`, {})
  assert.equal(del.ok, true)
  const list3 = await get('/api/brewPlan/list')
  assert.equal(list3.data.find((p) => p.id === id), undefined)
})

test('计划校验：非法步骤被拒', async () => {
  const r1 = await post('/api/brewPlan/save', { name: 'x', steps: [] })
  assert.equal(r1.ok, false)
  const r2 = await post('/api/brewPlan/save', {
    name: 'x',
    steps: [
      { type: 'pour', startS: 0, endS: 10, targetG: 45 },
      { type: 'pour', startS: 5, endS: 20, targetG: 40 }, // 重叠 + 目标不递增
    ],
  })
  assert.equal(r2.ok, false)
})

test('记录：保存 → 分页 → 详情 → 更新 → 删除', async () => {
  const planSaved = await post('/api/brewPlan/save', PLAN)
  const planId = planSaved.data.id

  const samples = { t: [0, 1000, 2000], w: [0, 45, 120], f: [0, 45, 75] }
  const rec = await post('/api/brewRecord/save', {
    mode: 'pour',
    planId,
    startedAt: Date.now(),
    endedAt: Date.now() + 2000,
    durationMs: 2000,
    coffeeWeight: 15,
    waterTotal: 240,
    peakFlow: 4.5,
    avgFlow: 2.1,
    deviceName: 'TIMEMORE_Dot',
    samples,
  })
  assert.equal(rec.ok, true)
  const id = rec.data.id

  // 分页
  const page = await get('/api/brewRecord/pageQuery?page=1&size=10&mode=pour')
  assert.equal(page.ok, true)
  assert.equal(page.data.total, 1)
  assert.equal(page.data.list[0].deviceName, 'TIMEMORE_Dot')
  assert.equal(page.data.list[0].samples, undefined) // 列表不含曲线

  // 详情含曲线
  const detail = await get(`/api/brewRecord/getById/${id}`)
  assert.equal(detail.ok, true)
  assert.deepEqual(detail.data.samples, samples)
  assert.equal(detail.data.planId, planId)

  // 更新评分备注
  const upd = await post(`/api/brewRecord/update/${id}`, { rating: 5, notes: '很棒' })
  assert.equal(upd.ok, true)
  const detail2 = await get(`/api/brewRecord/getById/${id}`)
  assert.equal(detail2.data.rating, 5)
  assert.equal(detail2.data.notes, '很棒')

  // 删除
  const del = await post(`/api/brewRecord/delete/${id}`, {})
  assert.equal(del.ok, true)
  const detail3 = await get(`/api/brewRecord/getById/${id}`)
  assert.equal(detail3.ok, false)

  await post(`/api/brewPlan/delete/${planId}`, {})
})

test('记录校验：samples 数组不一致被拒', async () => {
  const r = await post('/api/brewRecord/save', {
    mode: 'pour',
    startedAt: Date.now(),
    samples: { t: [0, 100], w: [0], f: [0] },
  })
  assert.equal(r.ok, false)
})
