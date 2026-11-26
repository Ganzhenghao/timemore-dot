<script setup lang="ts">
/**
 * 应用骨架：顶栏（品牌 / 连接状态 / 导航）+ 视图容器。
 * 视图用 tab 切换 + keep-alive 保持称量页的实时状态。
 */
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { storeToRefs } from 'pinia'
import { useDeviceStore } from './stores/device'
import { useModeStore } from './stores/mode'
import { usePlansStore } from './stores/plans'
import WeighView from './views/WeighView.vue'
import PlansView from './views/PlansView.vue'
import HistoryView from './views/HistoryView.vue'
import SettingsView from './views/SettingsView.vue'
import AppToast from './components/AppToast.vue'

type Tab = 'weigh' | 'plans' | 'history' | 'settings'

const device = useDeviceStore()
const plans = usePlansStore()
const modeStore = useModeStore()
const { mode } = storeToRefs(modeStore)
const { setMode } = modeStore
const tab = ref<Tab>((localStorage.getItem('tab') as Tab) || 'weigh')
watch(tab, (v) => localStorage.setItem('tab', v))

const tabViews: Record<Tab, Component> = {
  weigh: WeighView,
  plans: PlansView,
  history: HistoryView,
  settings: SettingsView,
}
/** KeepAlive 只接受单一子节点，故用动态组件承载各视图 */
const currentView = computed(() => tabViews[tab.value])

const tabs: { key: Tab; label: string }[] = [
  { key: 'weigh', label: '称量' },
  { key: 'plans', label: '冲煮计划' },
  { key: 'history', label: '历史记录' },
  { key: 'settings', label: '设置' },
]

const statusText = {
  disconnected: '未连接',
  connecting: '连接中…',
  connected: device.isSimulator ? '仿真秤' : '已连接',
} as const

onMounted(() => {
  plans.load()
})
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v3M7 21h10M5 8h14l-2 9H7L5 8z" stroke="var(--ac)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="brand-name">Timemore Dot</span>
        <span class="brand-sub">网页电子秤</span>
      </div>

      <div class="conn" :data-state="device.connectionState">
        <span class="conn-dot" aria-hidden="true"></span>
        <span class="conn-text">{{ statusText[device.connectionState] }}</span>
        <template v-if="device.isConnected">
          <span v-if="device.signalLost" class="conn-warn">信号丢失</span>
          <span v-else class="battery" :title="`电量 ${device.batteryPercent}%`">
            <svg width="18" height="12" viewBox="0 0 20 12" aria-hidden="true">
              <rect x="0.5" y="0.5" width="16" height="11" rx="2" stroke="var(--tx-mute)" fill="none" />
              <rect x="17" y="3.5" width="2.5" height="5" rx="1" fill="var(--tx-mute)" />
              <rect x="2.5" y="2.5" :width="Math.max(1, (device.batteryPercent / 100) * 12)" height="7" rx="1" :fill="device.batteryPercent > 20 ? 'var(--ok)' : 'var(--err)'" />
            </svg>
            <span class="num">{{ device.batteryPercent }}%</span>
          </span>
        </template>
      </div>

      <!-- 模式切换：仅称量页可见，放在顶栏避免占用左栏纵向空间 -->
      <div
        v-if="tab === 'weigh' && device.isConnected"
        class="mode-switch"
        role="radiogroup"
        aria-label="模式切换"
      >
        <button
          v-for="m in (['pour', 'standard'] as const)"
          :key="m"
          type="button"
          role="radio"
          :aria-checked="mode === m"
          class="mode-btn"
          :class="{ active: mode === m }"
          @click="setMode(m)"
        >
          {{ m === 'pour' ? '手冲' : '标准' }}
        </button>
      </div>

      <nav class="tabs" aria-label="视图导航">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="tab"
          :class="{ active: tab === t.key }"
          :aria-current="tab === t.key ? 'page' : undefined"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </nav>
    </header>

    <main class="content">
      <KeepAlive>
        <component :is="currentView" />
      </KeepAlive>
    </main>

    <AppToast />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
  height: 52px;
  border-bottom: 1px solid var(--bd);
  background: var(--bg-soft);
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.brand-name {
  font-family: Georgia, 'Times New Roman', serif;
  letter-spacing: 0.12em;
  color: var(--ac);
  font-size: 14px;
}

.brand-sub {
  color: var(--tx-faint);
  font-size: 11px;
  letter-spacing: 0.2em;
}

.conn {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--tx-mute);
}

.conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tx-faint);
}

.conn[data-state='connected'] .conn-dot {
  background: var(--ok);
  box-shadow: 0 0 8px rgba(94, 196, 122, 0.6);
}

.conn[data-state='connecting'] .conn-dot {
  background: var(--ac);
  animation: blink 0.8s infinite;
}

@keyframes blink {
  50% {
    opacity: 0.3;
  }
}

.conn-warn {
  color: var(--err);
}

.battery {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

/* 模式切换（顶栏） */
.mode-switch {
  display: inline-flex;
  border: 1px solid var(--bd);
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.mode-btn {
  padding: 4px 14px;
  font-size: 12px;
  color: var(--tx-mute);
  background: var(--bg-soft);
  transition: background 0.15s, color 0.15s;
}

.mode-btn:hover {
  color: var(--tx);
}

.mode-btn.active {
  background: var(--ac);
  color: #141414;
  font-weight: 600;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.tab {
  padding: 8px 16px;
  font-size: 13px;
  color: var(--tx-mute);
  border-radius: 4px;
  border: 1px solid transparent;
}

.tab:hover {
  color: var(--tx);
  background: var(--bg-raise);
}

.tab.active {
  color: var(--ac);
  border-color: var(--bd);
  background: var(--bg-raise);
}

.content {
  flex: 1;
  overflow: auto;
}
</style>
