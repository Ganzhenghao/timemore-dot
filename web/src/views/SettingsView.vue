<script setup lang="ts">
/**
 * 设置：数据库配置只读展示（启动前由 config/database.json 或环境变量决定）、
 * 设备信息与工具（关机需确认）、应用说明。
 */
import { onMounted, ref } from 'vue'
import { api, type DbConfigView } from '../api/client'
import { useDeviceStore } from '../stores/device'
import { useToastStore } from '../stores/toast'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const device = useDeviceStore()
const toast = useToastStore()

// ── 数据库（只读） ───────────────────────────────────────────────────
const dbConfig = ref<DbConfigView | null>(null)

onMounted(async () => {
  try {
    dbConfig.value = await api.databaseCurrent()
  } catch (e) {
    toast.push(`读取配置失败: ${(e as Error).message}`, 'err')
  }
})

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
      <p class="card-desc">
        存储后端在启动前由 <code>config/database.json</code> 或环境变量决定，修改后需重启服务生效。
      </p>

      <div v-if="dbConfig" class="db-info">
        <div class="db-row">
          <span class="k">后端</span>
          <code class="v">{{ dbConfig.type === 'mysql' ? 'MySQL' : 'SQLite' }}</code>
        </div>
        <template v-if="dbConfig.type === 'mysql' && dbConfig.mysql">
          <div class="db-row">
            <span class="k">连接</span>
            <code class="v">{{ dbConfig.mysql.user }}@{{ dbConfig.mysql.host }}:{{ dbConfig.mysql.port }}</code>
          </div>
          <div class="db-row">
            <span class="k">数据库</span>
            <code class="v">{{ dbConfig.mysql.database }}</code>
          </div>
        </template>
        <div v-else class="db-row">
          <span class="k">文件位置</span>
          <code class="v">{{ dbConfig.sqlite.file }}</code>
        </div>
        <div class="db-row">
          <span class="k">配置文件</span>
          <code class="v">{{ dbConfig.configFile }}</code>
        </div>
      </div>

      <p v-if="dbConfig?.envOverrides.length" class="warn-tip">
        以下环境变量覆盖了配置文件：{{ dbConfig.envOverrides.join('、') }}
      </p>
      <p class="hint-inline">
        切换 MySQL：先手动创建数据库 → 编辑配置文件（模板 config/database.example.json）→ npm run db:check → 重启服务。
      </p>
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

.db-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.db-row {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 13px;
}

.db-row .k {
  color: var(--tx-mute);
  min-width: 64px;
}

.db-row .v {
  font-family: var(--num-font);
  color: var(--ac);
  background: var(--bg-raise);
  padding: 4px 8px;
  border-radius: 4px;
  word-break: break-all;
}

.hint-inline {
  font-size: 11px;
  color: var(--tx-faint);
  margin-top: 12px;
  line-height: 1.6;
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

.btn.danger {
  color: var(--err);
  border-color: rgba(224, 85, 85, 0.4);
}
</style>
