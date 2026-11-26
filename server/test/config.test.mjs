/**
 * 数据库配置单测：默认值、路径解析、环境变量覆盖、非法配置报错、首次生成。
 * 均使用临时文件与显式 env，避免读写真实 config/database.json。
 */
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DEFAULT_SQLITE_FILE, ensureConfigFile, listEnvOverrides, loadConfig } from '../src/config.js'

const ROOT = path.dirname(path.dirname(DEFAULT_SQLITE_FILE))
const tmp = mkdtempSync(path.join(tmpdir(), 'timemore-config-'))
const configAt = (name) => path.join(tmp, name)

function writeCfg(name, data) {
  const file = configAt(name)
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data))
  return file
}

after(() => rmSync(tmp, { recursive: true, force: true }))

test('配置缺失时使用默认 SQLite', () => {
  const cfg = loadConfig({ configFile: configAt('missing.json'), env: {} })
  assert.equal(cfg.type, 'sqlite')
  assert.equal(cfg.sqlite.file, DEFAULT_SQLITE_FILE)
  assert.equal(cfg.mysql.port, 3306)
})

test('相对 sqlite.file 按项目根目录解析', () => {
  const file = writeCfg('relative.json', { type: 'sqlite', sqlite: { file: 'data/custom.db' }, mysql: {} })
  const cfg = loadConfig({ configFile: file, env: {} })
  assert.equal(cfg.sqlite.file, path.join(ROOT, 'data', 'custom.db'))
})

test('环境变量覆盖配置文件', () => {
  const file = writeCfg('env.json', {
    type: 'sqlite',
    sqlite: { file: 'data/file.db' },
    mysql: { host: 'file-host', port: 3306, user: 'file-user', password: 'file-pass', database: 'file-db' },
  })
  const cfg = loadConfig({
    configFile: file,
    env: {
      DB_TYPE: 'MySQL',
      MYSQL_HOST: 'env-host',
      MYSQL_PORT: '3307',
      MYSQL_USER: 'env-user',
      MYSQL_PASSWORD: 'env-pass',
      MYSQL_DATABASE: 'env-db',
    },
  })
  assert.equal(cfg.type, 'mysql')
  assert.deepEqual(cfg.mysql, {
    host: 'env-host',
    port: 3307,
    user: 'env-user',
    password: 'env-pass',
    database: 'env-db',
  })
})

test('配置文件 JSON 损坏时报错而不是回退 SQLite', () => {
  const file = writeCfg('broken.json', '{ "type": "mysql", ')
  assert.throws(() => loadConfig({ configFile: file, env: {} }), /解析失败/)
})

test('非法 type 报错', () => {
  const file = writeCfg('bad-type.json', { type: 'postgres', sqlite: { file: 'x.db' } })
  assert.throws(() => loadConfig({ configFile: file, env: {} }), /type 必须为 sqlite 或 mysql/)
})

test('MySQL 必填参数缺失时报错', () => {
  // host 有默认 127.0.0.1，user/database 必须显式填写
  const file = writeCfg('mysql-empty.json', { type: 'mysql', sqlite: { file: 'x.db' }, mysql: {} })
  assert.throws(() => loadConfig({ configFile: file, env: {} }), /缺少 user、database/)
})

test('MySQL 端口非法时报错', () => {
  const file = writeCfg('mysql-port.json', {
    type: 'mysql',
    mysql: { host: 'h', user: 'u', database: 'd', port: 'abc' },
  })
  assert.throws(() => loadConfig({ configFile: file, env: {} }), /端口非法/)
})

test('type=sqlite 时不校验空的 mysql 段', () => {
  const file = writeCfg('sqlite-empty-mysql.json', { type: 'sqlite', sqlite: { file: 'x.db' }, mysql: {} })
  const cfg = loadConfig({ configFile: file, env: {} })
  assert.equal(cfg.type, 'sqlite')
})

test('ensureConfigFile 生成默认配置且不覆盖已有文件', () => {
  const file = configAt(path.join('nested', 'database.json'))
  assert.equal(ensureConfigFile({ configFile: file }), true)
  assert.ok(existsSync(file))
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).type, 'sqlite')

  const custom = '{"type":"sqlite","sqlite":{"file":"custom.db"}}'
  writeFileSync(file, custom)
  assert.equal(ensureConfigFile({ configFile: file }), false)
  assert.equal(readFileSync(file, 'utf8'), custom)
})

test('listEnvOverrides 只返回当前后端相关的变量', () => {
  const env = { DB_TYPE: 'mysql', MYSQL_HOST: 'h', SQLITE_FILE: 's.db', MYSQL_PASSWORD: '' }
  assert.deepEqual(listEnvOverrides('sqlite', env), ['DB_TYPE', 'SQLITE_FILE'])
  assert.deepEqual(listEnvOverrides('mysql', env), ['DB_TYPE', 'MYSQL_HOST'])
})
