/**
 * 启动前数据库预检：读取 config/database.json（及环境变量）并验证连通性。
 * 不启动服务、不执行 DDL、不修改数据库；失败以非 0 退出。
 * 用法: npm run db:check
 */
import { CONFIG_FILE, EXAMPLE_CONFIG_FILE, ensureConfigFile, listEnvOverrides, loadConfig } from '../server/src/config.js'
import { MysqlDb, SqliteDb } from '../server/src/db/adapter.js'

async function main() {
  if (ensureConfigFile()) console.log(`[db:check] 已生成默认配置: ${CONFIG_FILE}`)

  const cfg = loadConfig()
  console.log(`[db:check] 配置文件: ${CONFIG_FILE}`)

  const overrides = listEnvOverrides(cfg.type)
  if (overrides.length) console.log(`[db:check] 环境变量覆盖: ${overrides.join(', ')}`)

  if (cfg.type === 'mysql') {
    console.log(`[db:check] 存储后端: MySQL ${cfg.mysql.user}@${cfg.mysql.host}:${cfg.mysql.port}/${cfg.mysql.database}`)
    const db = new MysqlDb(cfg.mysql)
    try {
      const { version } = await db.probe()
      console.log(`[db:check] 连接成功: MySQL ${version}`)
      console.log('[db:check] 提示: 预检不执行 DDL，表结构将在服务启动时自动创建并写入默认计划。')
    } finally {
      await db.close()
    }
    return
  }

  console.log(`[db:check] 存储后端: SQLite ${cfg.sqlite.file}`)
  const { exists } = await new SqliteDb(cfg.sqlite.file).probe()
  console.log(
    exists
      ? '[db:check] 检查通过: 数据库文件可读'
      : '[db:check] 检查通过: 数据库文件尚不存在，目录可写，将在启动时自动创建',
  )
}

main().catch((e) => {
  console.error(`[db:check] 预检失败: ${e.message}`)
  console.error(`  配置文件: ${CONFIG_FILE}`)
  console.error(`  配置示例: ${EXAMPLE_CONFIG_FILE}`)
  process.exit(1)
})
