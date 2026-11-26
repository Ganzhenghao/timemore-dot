# timemore-dot

基于泰摩开放协议（Timemore Black Mirror SCALE BLE Protocol v1.0.3）实现的本地网页电子秤，仅适配 **Timemore DOT（TES017）**，面向桌面版 Chrome。

## 快速开始

```bash
npm install
npm run build        # 构建前端
npm start            # 启动服务 → http://localhost:3001
```

开发模式（前后端热更新）：

```bash
npm run dev          # 后端 :3001 + 前端 Vite :6666
```

测试：

```bash
npm test             # 后端 node:test + 前端 vitest（共 48 项）
npm run verify:crc   # 复核协议 CRC 字节结论
```

> Web Bluetooth 需要 Chrome 安全上下文：通过 `http://localhost` 访问即可（无需 https）。
> 页面刷新后浏览器会撤销 BLE 授权，需在称量页重新连接；未关闭页签时设备休眠可用「重新连接」恢复。

## 功能

**标准模式**：称重、去皮。

**手冲模式**：
- 称重 / 去皮、实时流速（秤上报 0.1g/s 分辨率 + EMA 平滑）
- 粉水比：任意时刻点「设定咖啡粉」记录当前重量为粉量并自动去皮，此后显示注水量与实时 1:x
- 计时：软件计时为真源并镜像同步秤硬件计时；自动计时开（预备 3 秒后注水自动开始）/ 关（按钮或双击空格开始）
- 冲煮曲线：实时曲线 + hover 读数
- 冲煮计划：多计划 CRUD、步骤编辑（注水/停顿、时间窗、目标克重）、选中即预览目标曲线、按计划冲煮时展示当前/下一步骤与目标差距 Δ、实际 vs 计划对比
- 历史冲煮记录：结束自动保存（含曲线采样）、分页列表、详情对比、评分备注、删除

**数据存储**：默认项目内 SQLite（`data/timemore.db`）；设置页可配置远程 MySQL（`测试连接` → `保存并切换` 热切换，自动建表）。连接参数存于本地 `config/database.json`（已 gitignore，密码不入库）。

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

## 项目结构

```
├── docs/                    # 协议文档
├── scripts/verify-crc.mjs   # CRC 算法验证记录（可复跑）
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
