<script setup lang="ts">
/**
 * 设置：数据库配置（默认 SQLite，可切换远程 MySQL，测试连接后保存热切换）、
 * 设备信息与工具（关机需确认）、应用说明。
 */
import { onMounted, reactive, ref } from 'vue'
import { api } from '../api/client'
import { useDeviceStore } from '../stores/device'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const device = useDeviceStore()
const toast = useToastStore()

// ── 数据库 ───────────────────────────────────────────────────────────
const dbType = ref<'sqlite' | 'mysql'>('sqlite')
const dbSqliteFile = ref('')
const mysqlForm = reactive({ host: '127.0.0.1', port: 3306, user: '', password: '', database: '' })
const testing = ref(false)
const saving = ref(false)

onMounted(async () => {
  try {
    const cfg = await api.databaseCurrent()
    dbType.value = cfg.type
    dbSqliteFile.value = cfg.sqlite.file
    if (cfg.mysql) Object.assign(mysqlForm, cfg.mysql)
  } catch (e) {
    toast.push(`读取配置失败: ${(e as Error).message}`, 'err')
  }
})

function buildPayload(): unknown {
  if (dbType.value === 'sqlite') return { type: 'sqlite' }
  return { type: 'mysql', mysql: { ...mysqlForm } }
}

async function testConnection(): Promise<void> {
  testing.value = true
  try {
    await api.databaseTest(buildPayload())
    toast.push('连接成功', 'ok')
  } catch (e) {
    toast.push((e as Error).message, 'err')
  } finally {
    testing.value = false
  }
}

async function saveDb(): Promise<void> {
  saving.value = true
  try {
    await api.databaseSave(buildPayload())
    toast.push(`已切换到 ${dbType.value === 'mysql' ? 'MySQL' : 'SQLite'}，后续数据将存入新位置`, 'ok')
  } catch (e) {
    toast.push((e as Error).message, 'err')
  } finally {
    saving.value = false
  }
}

// ── 设备工具 ─────────────────────────────────────────────────────────
const powerOffConfirm = ref(false)

async function confirmPowerOff(): Promise<void> {
  try {
    const ok = await device.ensureScale().powerOff()
    toast.push(ok ? '关机指令已发送' : '关机指令未确认（秤可能已断开）', ok ? 'ok' : 'warn')
  } catch (e) {
    toast.push(`发送失败: ${(e as Error).message}`, 'err')
  }
}
</script>

<template>
  <div class="settings">
    <h1>设置</h1>

    <!-- 数据库 -->
    <section class="card" aria-labelledby="db-title">
      <h2 id="db-title">数据存储</h2>
      <p class="card-desc">默认使用项目内 SQLite 文件；配置远程 MySQL 后所有数据将存入该库（切换后自动建表）。</p>

      <div class="db-type" role="radiogroup" aria-label="数据库类型">
        <button
          v-for="t in (['sqlite', 'mysql'] as const)"
          :key="t"
          type="button"
          role="radio"
          :aria-checked="dbType === t"
          class="type-btn"
          :class="{ active: dbType === t }"
          @click="dbType = t"
        >
          {{ t === 'sqlite' ? 'SQLite（默认）' : 'MySQL' }}
        </button>
      </div>

      <div v-if="dbType === 'sqlite'" class="sqlite-info">
        <span class="k">文件位置</span>
        <code class="v">{{ dbSqliteFile }}</code>
      </div>

      <form v-else class="mysql-form" @submit.prevent="saveDb">
        <div class="field-row">
          <div class="field">
            <label for="my-host">主机</label>
            <input id="my-host" v-model.trim="mysqlForm.host" name="my-host" required />
          </div>
          <div class="field">
            <label for="my-port">端口</label>
            <input id="my-port" v-model.number="mysqlForm.port" name="my-port" type="text" inputmode="numeric" required />
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="my-user">用户名</label>
            <input id="my-user" v-model.trim="mysqlForm.user" name="my-user" autocomplete="off" required />
          </div>
          <div class="field">
            <label for="my-pass">密码</label>
            <input id="my-pass" v-model="mysqlForm.password" name="my-pass" type="password" autocomplete="off" />
          </div>
        </div>
        <div class="field">
          <label for="my-db">数据库名</label>
          <input id="my-db" v-model.trim="mysqlForm.database" name="my-db" required />
        </div>
        <p class="hint-inline">密码仅保存在本地 config/database.json（不入库、不提交 Git）</p>
        <div class="actions">
          <button class="btn" type="button" :disabled="testing" @click="testConnection()">
            {{ testing ? '测试中…' : '测试连接' }}
          </button>
          <button class="btn primary" type="submit" :disabled="saving">
            {{ saving ? '切换中…' : '保存并切换' }}
          </button>
        </div>
      </form>
    </section>

    <!-- 设备 -->
    <section class="card" aria-labelledby="dev-title">
      <h2 id="dev-title">设备</h2>
      <dl v-if="device.isConnected" class="dev-info">
        <div><dt>名称</dt><dd>{{ device.deviceInfo.scaleName || device.deviceInfo.bleName || '—' }}</dd></div>
        <div><dt>型号</dt><dd>{{ device.deviceInfo.modelNumber || '—' }}</dd></div>
        <div><dt>固件</dt><dd>{{ device.deviceInfo.firmware || '—' }}</dd></div>
        <div><dt>制造商</dt><dd>{{ device.deviceInfo.manufacturer || '—' }}</dd></div>
        <div><dt>电量</dt><dd class="num">{{ device.batteryText }}</dd></div>
      </dl>
      <p v-else class="card-desc">未连接设备。到「称量」页连接 DOT 秤或启用仿真秤。</p>

      <p v-if="device.deviceInfo.modelMismatch" class="warn-tip">
        型号与 TES017 不符（{{ device.deviceInfo.modelNumber }}），本应用仅针对 DOT 实现，其他型号可能工作异常。
      </p>

      <div v-if="device.isConnected" class="actions">
        <button class="btn" @click="device.reconnect()">重新连接</button>
        <button class="btn" @click="device.disconnect()">断开</button>
        <button class="btn danger" @click="powerOffConfirm = true">秤关机</button>
      </div>
    </section>

    <!-- 说明 -->
    <section class="card" aria-labelledby="about-title">
      <h2 id="about-title">关于</h2>
      <p class="card-desc">
        基于泰摩开放协议（Timemore Black Mirror SCALE BLE Protocol v1.0.3）实现的本地网页电子秤，
        仅适配 Timemore DOT（TES017）。Web Bluetooth 需要桌面版 Chrome 并通过 localhost 访问；
        页面刷新后需重新连接秤（浏览器授权限制）。
      </p>
    </section>

    <ConfirmDialog
      v-model:open="powerOffConfirm"
      title="关闭电子秤？"
      message="将发送关机指令，秤会进入关机/休眠状态，可随时通过秤上的按键重新开机。"
      confirm-text="关机"
      danger
      @confirm="confirmPowerOff"
    />
  </div>
</template>

<style scoped>
.settings {
  padding: 24px 32px;
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

h1 {
  font-size: 20px;
  font-weight: 400;
}

.card {
  border: 1px solid var(--bd);
  border-radius: 6px;
  background: var(--bg-soft);
  padding: 20px 24px;
}

.card h2 {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 8px;
}

.card-desc {
  color: var(--tx-mute);
  font-size: 13px;
  margin-bottom: 16px;
  line-height: 1.7;
}

.db-type {
  display: inline-flex;
  border: 1px solid var(--bd);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.type-btn {
  padding: 8px 20px;
  font-size: 13px;
  color: var(--tx-mute);
  background: var(--bg);
}

.type-btn.active {
  background: var(--ac);
  color: #141414;
  font-weight: 600;
}

.sqlite-info {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 13px;
}

.sqlite-info .k {
  color: var(--tx-mute);
}

.sqlite-info .v {
  font-family: var(--num-font);
  color: var(--ac);
  background: var(--bg-raise);
  padding: 6px 10px;
  border-radius: 4px;
  word-break: break-all;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.field label {
  font-size: 12px;
  color: var(--tx-mute);
}

.field input {
  background: var(--bg-raise);
  border: 1px solid var(--bd-strong);
  border-radius: 4px;
  color: var(--tx);
  padding: 8px 10px;
  font-size: 13px;
  width: 100%;
}

.field input:user-invalid {
  border-color: var(--err);
  background: rgba(224, 85, 85, 0.08);
}

.hint-inline {
  font-size: 11px;
  color: var(--tx-faint);
  margin-bottom: 12px;
}

.actions {
  display: flex;
  gap: 10px;
}

.dev-info {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 24px;
  margin-bottom: 16px;
}

.dev-info div {
  display: flex;
  gap: 10px;
  font-size: 13px;
}

.dev-info dt {
  color: var(--tx-mute);
  min-width: 56px;
}

.warn-tip {
  color: var(--warn);
  font-size: 12px;
  margin-bottom: 12px;
}

.btn {
  padding: 9px 16px;
  border-radius: 4px;
  border: 1px solid var(--bd-strong);
  background: var(--bg);
  color: var(--tx);
  font-size: 13px;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  background: var(--bg-raise);
}

.btn.primary {
  background: var(--ac);
  border-color: var(--ac);
  color: #141414;
  font-weight: 600;
}

.btn.danger {
  color: var(--err);
  border-color: rgba(224, 85, 85, 0.4);
}

.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
