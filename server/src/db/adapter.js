/**
 * 数据库适配层：SQLite（better-sqlite3）与 MySQL（mysql2）共用一套
 * query/execute 接口与业务 SQL。
 * 兼容性约束：只用双方都支持的语法（? 占位符、LIMIT ? OFFSET ?、
 * 普通 SELECT/INSERT/UPDATE/DELETE），插入自增 id 由适配器统一返回。
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import mysql from 'mysql2/promise'
import { ddl } from './schema.js'

export class SqliteDb {
    dialect = 'sqlite'
  #db = null

  constructor(filePath) {
    this.filePath = filePath
  }

  async init() {
    mkdirSync(path.dirname(this.filePath), { recursive: true })
    this.#db = new BetterSqlite3(this.filePath)
    this.#db.pragma('journal_mode = WAL')
    for (const sql of ddl('sqlite')) this.#db.exec(sql)
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
  #pool = null

  constructor(cfg) {
    this.cfg = cfg
  }

  async init() {
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
    const conn = await this.#pool.getConnection()
    try {
      await conn.ping()
    } finally {
      conn.release()
    }
    for (const sql of ddl('mysql')) await this.#pool.execute(sql)
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
}

/** 当前活动数据库实例的管理器：支持配置热切换 */
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
  }

  /** 切换数据库（旧连接关闭；新库建表失败抛错，保持引用由调用方决定回滚） */
  async switchTo(cfg) {
    const next = await createDb(cfg)
    await this.#db?.close()
    this.#db = next
    this.#cfg = cfg
  }
}

async function createDb(cfg) {
  const db = cfg.type === 'mysql' ? new MysqlDb(cfg.mysql) : new SqliteDb(cfg.sqlite.file)
  await db.init()
  return db
}
