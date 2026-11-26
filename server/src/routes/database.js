/**
 * 数据库配置路由：只读展示启动时生效的配置（密码脱敏）。
 * 修改 config/database.json 或环境变量后需重启服务。
 */
import { Router } from 'express'
import { CONFIG_FILE, listEnvOverrides } from '../config.js'

export function databaseRoutes(dbm) {
  const r = Router()

  r.get('/database/current', (req, res) => {
    const cfg = dbm.cfg
    res.json({
      ok: true,
      data: {
        type: cfg.type,
        sqlite: { file: cfg.sqlite.file },
        // 密码不回传；已保存的其余参数原样回显
        mysql: cfg.mysql
          ? { host: cfg.mysql.host, port: cfg.mysql.port, user: cfg.mysql.user, database: cfg.mysql.database }
          : undefined,
        configFile: CONFIG_FILE,
        envOverrides: listEnvOverrides(cfg.type),
      },
    })
  })

  return r
}
