/**
 * 默认计划种子：仅新库首次建表时写入一次。
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DbManager } from '../src/db/adapter.js'

const tmp = mkdtempSync(path.join(tmpdir(), 'timemore-seed-'))
const cfg = { type: 'sqlite', sqlite: { file: path.join(tmp, 'seed.db') } }

after(() => rmSync(tmp, { recursive: true, force: true }))

test('新库首次建表写入默认三段式计划', async () => {
  const dbm = new DbManager()
  await dbm.init(cfg)
  const rows = await dbm.db.query('SELECT * FROM brew_plan')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, '经典三段式')
  assert.equal(JSON.parse(rows[0].steps).length, 6)
  await dbm.db.close()
})

test('再次启动不重复写入默认计划', async () => {
  const dbm = new DbManager()
  await dbm.init(cfg)
  const rows = await dbm.db.query('SELECT * FROM brew_plan')
  assert.equal(rows.length, 1)
  await dbm.db.close()
})

test('用户删除默认计划后重启不会恢复', async () => {
  const dbm = new DbManager()
  await dbm.init(cfg)
  await dbm.db.execute('DELETE FROM brew_plan')
  await dbm.db.close()

  const again = new DbManager()
  await again.init(cfg)
  const rows = await again.db.query('SELECT * FROM brew_plan')
  assert.equal(rows.length, 0)
  await again.db.close()
})
