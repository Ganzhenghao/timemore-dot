/**
 * 数据库配置路由：查询当前配置（脱敏）、测试连接、保存切换。
 * 遵循 GET 查询 / POST 变更的约定。
 */
import { Router } from 'express'
import { loadConfig, saveConfig, DEFAULT_SQLITE_FILE } from '../config.js'
import { DbManager, MysqlDb } from '../db/adapter.js'

export function databaseRoutes(dbm) {
  const r = Router()

  r.get('/database/current', (req, res) => {
    const cfg = dbm.cfg ?? loadConfig()
    res.json({
      ok: true,
      data: {
        type: cfg.type,
        sqlite: { file: cfg.sqlite?.file ?? DEFAULT_SQLITE_FILE },
        // 密码不回传；已保存的其余参数原样回显便于编辑
        mysql: cfg.mysql
          ? { host: cfg.mysql.host, port: cfg.mysql.port, user: cfg.mysql.user, database: cfg.mysql.database }
          : undefined,
      },
    })
  })

  r.post('/database/test', async (req, res) => {
    try {
      const cfg = parseBody(req.body)
      if (cfg.type === 'mysql') {
        const probe = new MysqlDb(cfg.mysql)
        try {
          await probe.init()
        } finally {
          await probe.close()
        }
      }
      res.json({ ok: true, data: { message: '连接成功' } })
    } catch (e) {
      res.status(400).json({ ok: false, error: `连接失败: ${e.message}` })
    }
  })

  r.post('/database/save', async (req, res) => {
    try {
      const cfg = parseBody(req.body)
      if (cfg.type === 'mysql') {
        // 先验证再切换，失败不影响当前使用
        const probe = new MysqlDb(cfg.mysql)
        try {
          await probe.init()
        } finally {
          await probe.close()
        }
      }
      const merged = mergeForSave(dbm.cfg ?? loadConfig(), cfg)
      await dbm.switchTo(merged)
      saveConfig(merged)
      res.json({ ok: true, data: { type: merged.type } })
    } catch (e) {
      res.status(400).json({ ok: false, error: `切换失败: ${e.message}` })
    }
  })

  return r
}

function parseBody(body) {
  const type = body?.type
  if (type !== 'mysql' && type !== 'sqlite') {
    throw new Error('type 必须为 sqlite 或 mysql')
  }
  if (type === 'sqlite') return { type, sqlite: { file: DEFAULT_SQLITE_FILE } }
  const { host, port, user, password, database } = body.mysql ?? {}
  if (!host || !user || !database) {
    throw new Error('MySQL 需要 host、user、database')
  }
  return {
    type,
    mysql: { host: String(host), port: Number(port) || 3306, user: String(user), password: String(password ?? ''), database: String(database) },
  }
}

/** 切到 mysql 时若密码留空，沿用已保存密码，避免每次都要重输 */
function mergeForSave(saved, next) {
  if (next.type === 'mysql' && saved.type === 'mysql' && !next.mysql.password && saved.mysql?.password) {
    next.mysql.password = saved.mysql.password
  }
  return next
}
