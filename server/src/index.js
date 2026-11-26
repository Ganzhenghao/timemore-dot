/**
 * 本地服务：API + 前端静态托管（web/dist）。
 * 仅监听 localhost，不做 https —— Web Bluetooth 把 localhost 视为安全上下文。
 */
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { loadConfig } from './config.js'
import { DbManager } from './db/adapter.js'
import { databaseRoutes } from './routes/database.js'
import { brewPlanRoutes } from './routes/brewPlan.js'
import { brewRecordRoutes } from './routes/brewRecord.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DIST = path.join(ROOT, 'web', 'dist')
const PORT = Number(process.env.PORT) || 3001

export async function createApp(config = loadConfig()) {
  const dbm = new DbManager()
  await dbm.init(config)

  const app = express()
  app.use(express.json({ limit: '4mb' }))

  app.get('/api/health', (req, res) => res.json({ ok: true, data: { db: dbm.cfg.type } }))
  app.use('/api', databaseRoutes(dbm))
  app.use('/api', brewPlanRoutes(dbm))
  app.use('/api', brewRecordRoutes(dbm))

  if (existsSync(DIST)) {
    app.use(express.static(DIST))
    // SPA 回退：非 /api 的 GET 请求返回 index.html
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next()
      res.sendFile(path.join(DIST, 'index.html'))
    })
  }

  return { app, dbm }
}

if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  createApp()
    .then(({ app }) => {
      app.listen(PORT, '127.0.0.1', () => {
        console.log(`[timemore-dot] http://localhost:${PORT}`)
      })
    })
    .catch((e) => {
      console.error('启动失败:', e)
      process.exit(1)
    })
}
