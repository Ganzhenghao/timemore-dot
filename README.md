# Timemore Dot 网页电子秤

基于泰摩开放协议（Timemore Black Mirror SCALE BLE Protocol v1.0.3）实现的本地网页电子秤，仅适配 **Timemore DOT（TES017）**，面向桌面版 Chrome。

应用通过 Web Bluetooth 直接连接电子秤，提供标准称量、手冲冲煮、实时曲线、冲煮计划与历史记录等功能。数据默认保存在本地 SQLite，也可切换至 MySQL。

## 界面预览

### 设备连接

打开页面后连接 DOT 秤；浏览器会弹出设备选择窗口，选择 `TIMEMORE_Dot` 完成配对。没有实体设备时，可直接启用仿真秤体验完整流程。

| 首页：等待连接 | 浏览器：选择 DOT 秤 |
| :---: | :---: |
| ![首页未连接](<imgs/1-首页-未连接.png>) | ![浏览器设备选择](<imgs/2-首页-连接中.png>) |

### 手冲工作台

连接后可切换「手冲 / 标准」模式。手冲工作台集中展示重量、计时、流速、注水量与粉水比，并同步绘制实际冲煮曲线和计划目标线。

![手冲模式已连接](<imgs/3-手冲模式-已连接.png>)

### 冲煮计划与历史记录

计划编辑器支持配置注水、停顿步骤，设置时间窗与目标克重，并在保存前预览目标曲线。每次冲煮结束后会自动保存记录，可查看实际曲线与计划对比，并补充评分和备注。

| 编辑冲煮计划 | 查看历史记录 |
| :---: | :---: |
| ![编辑冲煮计划](<imgs/4-冲煮计划.png>) | ![历史冲煮记录](<imgs/5-历史计划.png>) |

### 典型使用流程

1. 启动服务，在桌面版 Chrome 中打开 `http://localhost:3001`。
2. 在「称量」页连接 DOT 秤，或启用仿真秤。
3. 选择「手冲」模式，设置咖啡粉量并选择冲煮计划。
4. 点击「预备」开始冲煮，实时查看曲线、计划进度和目标差距。
5. 冲煮结束后，在「历史记录」中回顾曲线、对比计划并记录评分备注。

## 快速开始

```bash
npm install
npm run build        # 构建前端
npm start            # 启动服务 → http://localhost:3001
```

开发模式（前后端热更新）：

```bash
npm run dev          # 后端 :3001 + 前端 Vite :7777
```

测试与预检：

```bash
npm test             # 后端 node:test + 前端 vitest
npm run db:check     # 启动前数据库配置预检（不启动服务、不建表）
npm run verify:crc   # 复核协议 CRC 字节结论
```

> Web Bluetooth 需要 Chrome 安全上下文：通过 `http://localhost` 访问即可（无需 https）。
> 页面刷新后浏览器会撤销 BLE 授权，需在称量页重新连接；未关闭页签时设备休眠可用「重新连接」恢复。

## 数据存储配置（启动前选择）

默认使用项目内 SQLite（`data/timemore.db`）。首次启动会自动生成 `config/database.json`（已 gitignore），修改后重启 `npm start` 生效；设置页仅只读展示当前配置。

切换为 MySQL：

1. 在 MySQL 中先创建数据库（应用自动建表并写入默认「经典三段式」计划，但不创建数据库），并确保账号有建表权限；
2. 编辑 `config/database.json`（模板见 `config/database.example.json`）：

   ```json
   {
     "type": "mysql",
     "sqlite": { "file": "data/timemore.db" },
     "mysql": {
       "host": "127.0.0.1",
       "port": 3306,
       "user": "root",
       "password": "你的密码",
       "database": "timemore"
     }
   }
   ```

3. 预检连接（不启动服务、不建表）：`npm run db:check`
4. 启动：`npm start`

配置优先级：**环境变量 > `config/database.json` > 默认 SQLite**。配置文件 JSON 损坏或参数非法时启动会直接失败并输出原因，不会静默回退到 SQLite。

| 环境变量 | 说明 |
| --- | --- |
| `DB_TYPE` | `sqlite` 或 `mysql` |
| `SQLITE_FILE` | SQLite 文件路径，相对路径按项目根目录解析 |
| `MYSQL_HOST` / `MYSQL_PORT` | MySQL 主机与端口（默认 3306） |
| `MYSQL_USER` / `MYSQL_PASSWORD` | MySQL 账号与密码 |
| `MYSQL_DATABASE` | 数据库名 |

示例：`DB_TYPE=mysql MYSQL_HOST=127.0.0.1 MYSQL_USER=root MYSQL_PASSWORD=secret MYSQL_DATABASE=timemore npm run db:check`

## 核心功能

**标准模式**：称重、去皮。

**手冲模式**：
- 称重 / 去皮、实时流速（秤上报 0.1g/s 分辨率 + EMA 平滑）
- 粉水比：任意时刻点「设定咖啡粉」记录当前重量为粉量并自动去皮，此后显示注水量与实时 1:x
- 计时：软件计时为真源并镜像同步秤硬件计时；自动计时开（预备 3 秒后注水自动开始）/ 关（按钮或双击空格开始）
- 冲煮曲线：实时曲线 + hover 读数
- 冲煮计划：多计划 CRUD、步骤编辑（注水/停顿、时间窗、目标克重）、选中即预览目标曲线、按计划冲煮时展示当前/下一步骤与目标差距 Δ、实际 vs 计划对比
- 历史冲煮记录：结束自动保存（含曲线采样）、分页列表、详情对比、评分备注、删除

**数据存储**：启动前通过 `config/database.json` 或环境变量选择 SQLite / MySQL（见上文「数据存储配置」）；MySQL 需先手动创建数据库，应用自动建表并在新库首次建表时写入默认「经典三段式」计划（已有库不会补写）。设置页只读展示当前后端与配置文件路径。

**仿真秤**：连接页可一键启用仿真秤（与真机同一协议解析路径），配合「速率滑块 / 按计划自动注水」在无硬件时完整体验与测试所有功能。

## 真机验证清单

以下依赖 BLE 实机行为（协议字节来自文档 + 参考实现 HCI 抓包，仿真无法覆盖），首次连接真机时请逐项确认：

- [ ] 连接：搜索到 `TIMEMORE` 前缀设备；Device Information 型号读数应为 `TES017`（不符会提示）
- [ ] 重量/流速/电量：100ms 上报、显示稳定，g/oz 切换
- [ ] 去皮：`03 0D` 硬件去皮生效（秤自身显示归零）；若无 ACK 自动回退软件去皮，界面仍归零
- [ ] 计时：开始/暂停/重置镜像到秤硬件计时
- [ ] 自动计时：预备 3 秒后注水自动开始
- [ ] 计划执行与对比曲线
- [ ] 断线重连：设备休眠后「重新连接」
- [ ] 关机命令（设置页，需确认）

若写命令（去皮/计时/关机）不生效，问题集中在 `web/src/ble/frames.ts`（帧字节）与 `web/src/ble/scaleClient.ts`（保活时序）两处：

- CRC 策略：官方 App 读命令一律 CRC=0000，写命令尾字节为 HCI 观测固定值且不可由任何标准 CRC-16 算法推导（见 `scripts/verify-crc.mjs` 的验证记录），协议文档亦标注 CRC 字段 reserved，故不校验也不计算
- 保活：官方 App 每 10 秒发送 `02 08` 读 + `03 08` 写（0x08 未载于文档），参考实现验证其为硬件命令被接受的前提，本实现完全复刻该节奏

## 真机连接失败排查

连接时报 `Unsupported device.`、`Connection failed for unknown reason.` 等错误时，按顺序排查：

1. **释放设备占用（最常见）**：BLE 秤通常只允许一个中心设备连接。
   - 关闭手机上的泰摩官方 App，并关闭手机蓝牙；
   - 关闭其他打开了本应用的 Chrome 标签页/窗口；
   - macOS「系统设置 → 蓝牙」中如已配对该秤，先移除。
2. **让秤进入可连接广播**：长按秤的蓝牙键进入配对/广播模式。协议 2.1 区分「白名单广播（01）/ 通用广播（02）」，被官方 App 绑定过的秤可能只接受绑定中心，必要时先用官方 App「忘记设备」（协议命令 `0x1A`）。
3. **区分浏览器层与设备层**：打开 `chrome://bluetooth-internals` → Scan → 找到 `TIMEMORE Dot`，查看 advertised services 是否含 `FFF0`，点 **Connect** 试连。若这里同样失败，问题在系统/设备侧，与本应用无关。
4. **权限与适配器**：macOS「系统设置 → 隐私与安全性 → 蓝牙」中勾选 Chrome；确认系统蓝牙已开启、未被其他蓝牙调试工具独占。
5. **换一条选择路径**：先点「显示全部设备」重试（绕过名称前缀过滤）；连接阶段失败后，可直接点错误卡片中的「重试连接（不再选择设备）」。

应用侧已内置的处理：

- GATT 连接 **10 秒超时**，失败自动重试 **最多 3 次**（间隔 500ms），覆盖设备刚唤醒、上次连接未释放等瞬态失败；
- 错误按阶段区分并给出建议：选择设备 / GATT 连接 / 服务发现（0xFFF0）/ 特征获取（0xFFF1·0xFFF2）/ 订阅通知；
- 原始 `DOMException` 名称（如 `NetworkError`）一并展示，并在开发者工具控制台输出 `[ble] GATT 连接失败（第 n/3 次）` 的详情。

## 项目结构

```
├── config/                  # database.example.json（数据库配置模板，实际配置 gitignored）
├── docs/                    # 协议文档
├── scripts/                 # verify-crc.mjs（CRC 验证）、check-db.mjs（数据库预检）
├── server/                  # Express 后端（ESM 纯 JS）
│   ├── src/db/              # SQLite / MySQL 适配器 + DDL（无物理外键）
│   ├── src/routes/          # database / brewPlan / brewRecord
│   └── test/                # node:test 集成测试
└── web/                     # Vue 3 + TS + Vite + Pinia
    └── src/
        ├── ble/             # frames(帧/CRC) scaleClient simulator
        ├── core/            # planModel(计划模型) brewSession(会话状态机) —— 纯逻辑单测
        ├── stores/          # device session plans toast
        ├── components/      # BrewChart(canvas) ConfirmDialog ToggleSwitch AppToast
        └── views/           # Weigh / Plans / History / Settings
```
