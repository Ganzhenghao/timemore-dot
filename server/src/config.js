/**
 * 数据库配置：默认项目内 SQLite，可在设置页切换远程 MySQL。
 * 配置存于 config/database.json（gitignored，含密码仅本地明文）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CONFIG_DIR = path.join(ROOT, 'config')
const CONFIG_FILE = path.join(CONFIG_DIR, 'database.json')
export const DATA_DIR = path.join(ROOT, 'data')

export const DEFAULT_SQLITE_FILE = path.join(DATA_DIR, 'timemore.db')

export function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
      if (cfg && (cfg.type === 'sqlite' || cfg.type === 'mysql')) return cfg
    }
  } catch {
    // 配置损坏按默认处理
  }
  return { type: 'sqlite', sqlite: { file: DEFAULT_SQLITE_FILE }, mysql: emptyMysql() }
}

export function saveConfig(cfg) {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8')
}

function emptyMysql() {
  return { host: '127.0.0.1', port: 3306, user: '', password: '', database: '' }
}
