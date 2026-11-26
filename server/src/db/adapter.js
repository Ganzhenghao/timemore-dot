/**
 * 数据库适配层：SQLite（better-sqlite3）与 MySQL（mysql2）共用一套
 * query/execute 接口与业务 SQL。
 * 兼容性约束：只用双方都支持的语法（? 占位符、LIMIT ? OFFSET ?、
 * 普通 SELECT/INSERT/UPDATE/DELETE），插入自增 id 由适配器统一返回。
 */
import { accessSync, constants, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import mysql from 'mysql2/promise'
import { ddl } from './schema.js'
import { seedDefaultPlan } from './seed.js'

export class SqliteDb {
  dialect = 'sqlite'
  /** 本次 init 是否新建了 brew_plan 表（用于首次写入默认数据） */
  createdSchema = false
  #db = null

  constructor(filePath) {
    this.filePath = filePath
  }

  /** 预检：文件存在时只读验证，不创建文件、不建表 */
  async probe() {
    if (existsSync(this.filePath)) {
      const db = new BetterSqlite3(this.filePath, { readonly: true })
      try {
        db.prepare('SELECT 1 AS ok').get()
      } finally {
        db.close()
      }
      return { exists: true }
    }
    assertDirWritable(path.dirname(this.filePath))
    return { exists: false }
  }

  async init() {
    mkdirSync(path.dirname(this.filePath), { recursive: true })
    this.#db = new BetterSqlite3(this.filePath)
    this.#db.pragma('journal_mode = WAL')
    this.createdSchema = !this.#hasTable('brew_plan')
    for (const sql of ddl('sqlite')) this.#db.exec(sql)
  }

  #hasTable(name) {
    return Boolean(
      this.#db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name),
    )
  }

  async query(sql, params = []) {
    return this.#db.prepare(sql).all(...params)
  }

  async execute(sql, params = []) {
    const r = this.#db.prepare(sql).run(...params)
    return { changes: r.changes, insertId: Number.isFinite(r.lastInsertRowid) ? Number(r.lastInsertRowid) : null }
  }

  async close() {
    this.#db?.close()
    this.#db = null
  }
}

export class MysqlDb {
  dialect = 'mysql'
  /** 本次 init 是否新建了 brew_plan 表（用于首次写入默认数据） */
  createdSchema = false
  #pool = null

  constructor(cfg) {
    this.cfg = cfg
  }

  /** 预检：只验证连接与库是否存在，不执行 DDL */
  async probe() {
    await this.#ensurePool()
    const [rows] = await this.#pool.query('SELECT VERSION() AS version')
    return { version: rows?.[0]?.version ?? 'unknown' }
  }

  async init() {
    await this.#ensurePool()
    try {
      this.createdSchema = await this.#isTableAbsent('brew_plan')
      for (const sql of ddl('mysql')) await this.#pool.execute(sql)
    } catch (e) {
      throw new Error(`MySQL 初始化表结构失败（${this.describe()}）: ${e.message}`)
    }
  }

  async query(sql, params = []) {
    const [rows] = await this.#pool.execute(sql, params)
    return rows
  }

  async execute(sql, params = []) {
    const [r] = await this.#pool.execute(sql, params)
    return { changes: r.affectedRows ?? 0, insertId: r.insertId ?? null }
  }

  async close() {
    await this.#pool?.end()
    this.#pool = null
  }

  describe() {
    return `${this.cfg.user}@${this.cfg.host}:${this.cfg.port}/${this.cfg.database}`
  }

  async #isTableAbsent(name) {
    const [rows] = await this.#pool.execute(
      'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
      [name],
    )
    return rows.length === 0
  }

  async #ensurePool() {
    if (this.#pool) return
    this.#pool = mysql.createPool({
      host: this.cfg.host,
      port: this.cfg.port,
      user: this.cfg.user,
      password: this.cfg.password,
      database: this.cfg.database,
      waitForConnections: true,
      connectionLimit: 5,
      timezone: '+00:00',
    })
    try {
      const conn = await this.#pool.getConnection()
      try {
        await conn.ping()
      } finally {
        conn.release()
      }
    } catch (e) {
      const pool = this.#pool
      this.#pool = null
      await pool.end().catch(() => {})
      throw new Error(`MySQL 连接失败（${this.describe()}）: ${e.message}；请确认数据库已创建、账号有权限`)
    }
  }
}

/** 当前活动数据库实例的管理器 */
export class DbManager {
  #db = null
  #cfg = null

  get cfg() {
    return this.#cfg
  }

  get db() {
    return this.#db
  }

  async init(cfg) {
    this.#cfg = cfg
    this.#db = await createDb(cfg)
    // 仅新库首次建表时写入默认计划，避免旧库被补数据或删除后反复恢复
    if (this.#db.createdSchema) {
      try {
        await seedDefaultPlan(this.#db)
      } catch (e) {
        throw new Error(`写入默认冲煮计划失败: ${e.message}`)
      }
    }
  }
}

async function createDb(cfg) {
  const db = cfg.type === 'mysql' ? new MysqlDb(cfg.mysql) : new SqliteDb(cfg.sqlite.file)
  await db.init()
  return db
}

/** SQLite 文件尚不存在时，检查最近的已存在父目录是否可写 */
function assertDirWritable(dir) {
  let cur = dir
  while (!existsSync(cur)) {
    const parent = path.dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  try {
    accessSync(cur, constants.W_OK)
  } catch {
    throw new Error(`SQLite 目录不可写: ${cur}`)
  }
}
