/**
 * 建表 DDL：SQLite / MySQL 两套方言。
 * 规范：不使用物理外键，表关联仅存业务 ID（planId 引用 brew_plan.id）。
 * 列名采用驼峰，与 API 字段一致，省去映射层。
 */

const SQLITE_DDL = [
  `CREATE TABLE IF NOT EXISTS brew_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    coffeeWeight REAL,
    ratio REAL,
    steps TEXT NOT NULL DEFAULT '[]',
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS brew_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL,
    planId INTEGER,
    startedAt INTEGER NOT NULL,
    endedAt INTEGER,
    durationMs INTEGER,
    coffeeWeight REAL,
    waterTotal REAL,
    peakFlow REAL,
    avgFlow REAL,
    deviceName TEXT,
    rating INTEGER,
    notes TEXT,
    samples TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_brew_record_startedAt ON brew_record(startedAt)`,
]

const MYSQL_DDL = [
  `CREATE TABLE IF NOT EXISTS brew_plan (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    coffeeWeight DOUBLE,
    ratio DOUBLE,
    steps MEDIUMTEXT NOT NULL,
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS brew_record (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    mode VARCHAR(20) NOT NULL,
    planId BIGINT UNSIGNED,
    startedAt BIGINT NOT NULL,
    endedAt BIGINT,
    durationMs BIGINT,
    coffeeWeight DOUBLE,
    waterTotal DOUBLE,
    peakFlow DOUBLE,
    avgFlow DOUBLE,
    deviceName VARCHAR(64),
    rating TINYINT,
    notes TEXT,
    samples MEDIUMTEXT,
    KEY idx_brew_record_startedAt (startedAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
]

export function ddl(dialect) {
  return dialect === 'mysql' ? MYSQL_DDL : SQLITE_DDL
}
