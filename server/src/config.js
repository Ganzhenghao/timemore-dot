/**
 * 数据库配置：启动时按 环境变量 > config/database.json > 默认 SQLite 的顺序解析。
 * 配置缺失时自动生成默认文件；文件损坏或参数非法直接报错，避免静默落到 SQLite。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CONFIG_DIR = path.join(ROOT, 'config')
export const CONFIG_FILE = path.join(CONFIG_DIR, 'database.json')
export const EXAMPLE_CONFIG_FILE = path.join(CONFIG_DIR, 'database.example.json')
export const DATA_DIR = path.join(ROOT, 'data')
export const DEFAULT_SQLITE_FILE = path.join(DATA_DIR, 'timemore.db')

const CONFIG_HINT =
  'type 可选 sqlite 或 mysql；MySQL 需预先创建 database（应用自动建表并写入默认计划）。' +
  '环境变量 DB_TYPE/SQLITE_FILE/MYSQL_* 优先于本文件。'

export function defaultConfig() {
  return {
    _comment: CONFIG_HINT,
    type: 'sqlite',
    sqlite: { file: 'data/timemore.db' },
    mysql: { host: '127.0.0.1', port: 3306, user: '', password: '', database: '' },
  }
}

/** 配置缺失时生成默认文件；已存在则不覆盖。返回是否新建。 */
export function ensureConfigFile({ configFile = CONFIG_FILE } = {}) {
  if (existsSync(configFile)) return false
  mkdirSync(path.dirname(configFile), { recursive: true })
  writeFileSync(configFile, JSON.stringify(defaultConfig(), null, 2) + '\n', 'utf8')
  return true
}

export function loadConfig({ configFile = CONFIG_FILE, env = process.env } = {}) {
  const cfg = normalizeConfig(readConfigFile(configFile) ?? defaultConfig())
  applyEnv(cfg, env)
  validateConfig(cfg, configFile)
  return cfg
}

/** 返回与给定后端相关的已设置环境变量名（用于设置页提示覆盖来源） */
export function listEnvOverrides(type, env = process.env) {
  const keys =
    type === 'mysql'
      ? ['DB_TYPE', 'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE']
      : ['DB_TYPE', 'SQLITE_FILE']
  return keys.filter((k) => env[k] !== undefined && env[k] !== '')
}

function readConfigFile(file) {
  if (!existsSync(file)) return null
  let parsed
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    throw new Error(`数据库配置解析失败（${file}）: ${e.message}`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`数据库配置格式错误（${file}）: 顶层必须是 JSON 对象`)
  }
  return parsed
}

function normalizeConfig(raw) {
  return {
    type: raw.type,
    sqlite: { file: resolvePath(raw.sqlite?.file || 'data/timemore.db') },
    mysql: {
      host: String(raw.mysql?.host ?? '127.0.0.1').trim(),
      port: Number(raw.mysql?.port ?? 3306),
      user: String(raw.mysql?.user ?? '').trim(),
      password: String(raw.mysql?.password ?? ''),
      database: String(raw.mysql?.database ?? '').trim(),
    },
  }
}

function applyEnv(cfg, env) {
  if (env.DB_TYPE !== undefined && env.DB_TYPE !== '') {
    cfg.type = String(env.DB_TYPE).trim().toLowerCase()
  }
  if (env.SQLITE_FILE) cfg.sqlite.file = resolvePath(env.SQLITE_FILE)
  if (env.MYSQL_HOST) cfg.mysql.host = String(env.MYSQL_HOST).trim()
  if (env.MYSQL_PORT !== undefined && env.MYSQL_PORT !== '') cfg.mysql.port = Number(env.MYSQL_PORT)
  if (env.MYSQL_USER !== undefined) cfg.mysql.user = String(env.MYSQL_USER).trim()
  if (env.MYSQL_PASSWORD !== undefined) cfg.mysql.password = String(env.MYSQL_PASSWORD)
  if (env.MYSQL_DATABASE !== undefined) cfg.mysql.database = String(env.MYSQL_DATABASE).trim()
}

function validateConfig(cfg, file) {
  if (cfg.type !== 'sqlite' && cfg.type !== 'mysql') {
    throw new Error(
      `数据库配置错误（${file} 或环境变量）: type 必须为 sqlite 或 mysql，当前为 ${JSON.stringify(cfg.type)}`,
    )
  }
  if (cfg.type === 'sqlite') {
    if (!cfg.sqlite.file) throw new Error('数据库配置错误: sqlite.file 不能为空')
    return
  }
  const missing = ['host', 'user', 'database'].filter((k) => !cfg.mysql[k])
  if (missing.length) {
    throw new Error(
      `MySQL 配置缺少 ${missing.join('、')}（config/database.json 的 mysql 段或 MYSQL_HOST/MYSQL_USER/MYSQL_DATABASE）`,
    )
  }
  if (!Number.isInteger(cfg.mysql.port) || cfg.mysql.port < 1 || cfg.mysql.port > 65535) {
    throw new Error(`MySQL 端口非法: ${cfg.mysql.port}（应为 1-65535 的整数）`)
  }
}

function resolvePath(file) {
  const value = String(file).trim()
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value)
}
