<script setup lang="ts">
/**
 * 称量视图：标准模式（称重/去皮）与手冲模式（计时/流速/粉水比/曲线/计划执行）。
 * 双击空格开始计时（输入框等可编辑元素聚焦时忽略）。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDeviceStore } from '../stores/device'
import { useSessionStore, SPACE_DOUBLE_TAP_MS } from '../stores/session'
import { usePlansStore } from '../stores/plans'
import { useModeStore } from '../stores/mode'
import { useToastStore } from '../stores/toast'
import BrewChart from '../components/BrewChart.vue'
import ToggleSwitch from '../components/ToggleSwitch.vue'
import type { ScaleSimulator } from '../ble/simulator'
import { ScaleConnectError } from '../ble/scaleClient'
import { targetCurve, formatClock } from '../core/planModel'

const device = useDeviceStore()
const session = useSessionStore()
const plans = usePlansStore()
const toast = useToastStore()

// 模式切换入口在顶栏（App.vue），这里只读共享状态
const { mode } = storeToRefs(useModeStore())

// ── 双击空格开始计时（手动触发，两种自动模式都可用） ──────────────────────
let lastSpaceAt = 0
function onKeydown(e: KeyboardEvent): void {
  if (e.code !== 'Space') return
  const t = e.target as HTMLElement
  if (t.closest('input, textarea, select, [contenteditable], [role="switch"]')) return
  const now = Date.now()
  if (now - lastSpaceAt <= SPACE_DOUBLE_TAP_MS) {
    e.preventDefault()
    lastSpaceAt = 0
    if (session.session.state === 'idle' || session.session.state === 'stopped') {
      session.startManual()
      toast.push('计时已开始', 'info')
    }
  } else {
    lastSpaceAt = now
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// ── 连接 ─────────────────────────────────────────────────────────────
const connecting = ref(false)
/** 连接失败详情：常驻卡片展示（原始错误常缺少上下文，toast 会自动消失） */
const connectError = ref<{ message: string; hints: string[] } | null>(null)

async function connect(showAll = false): Promise<void> {
  connecting.value = true
  connectError.value = null
  try {
    await device.connectReal({ showAllDevices: showAll })
    toast.push('秤已连接', 'ok')
  } catch (e) {
    const msg = (e as Error).message ?? ''
    if (/cancel|取消/i.test(msg)) return
    if (e instanceof ScaleConnectError) {
      connectError.value = { message: e.message, hints: e.hints }
    } else {
      connectError.value = { message: `连接失败：${msg}`, hints: [] }
    }
  } finally {
    connecting.value = false
  }
}

/** 免选择器重试（设备引用仍持有，无需再弹选择框） */
async function retryConnect(): Promise<void> {
  connecting.value = true
  connectError.value = null
  try {
    await device.reconnect()
    toast.push('秤已连接', 'ok')
  } catch (e) {
    if (e instanceof ScaleConnectError) {
      connectError.value = { message: e.message, hints: e.hints }
    } else {
      connectError.value = { message: `重试失败：${(e as Error).message}`, hints: [] }
    }
  } finally {
    connecting.value = false
  }
}

async function connectSim(): Promise<void> {
  try {
    await device.connectSim()
    toast.push('仿真秤已启用', 'ok')
  } catch (e) {
    toast.push(`仿真启动失败: ${(e as Error).message}`, 'err')
  }
}

// ── 仿真控制 ─────────────────────────────────────────────────────────
const simPourRate = ref(0)
function applySimRate(): void {
  const s = device.ensureScale() as ScaleSimulator
  s.setPourRate(simPourRate.value)
}

function simPlayFullBrew(): void {
  const plan = session.selectedPlan ?? plans.list[0]
  if (!plan) {
    toast.push('请先创建冲煮计划', 'warn')
    return
  }
  const s = device.ensureScale() as ScaleSimulator
  // 按计划的注水步骤生成注水脚本：速率 = 段注水量 / 段时长
  const script: { rateGps: number; durMs: number }[] = []
  let prev = 0
  for (const st of plan.steps) {
    if (st.type === 'pour') {
      const amount = (st.targetG ?? 0) - prev
      const durS = st.endS - st.startS
      if (amount > 0 && durS > 0) script.push({ rateGps: amount / durS, durMs: durS * 1000 })
      prev = st.targetG ?? prev
    }
  }
  s.playScript(script)
  toast.push(`仿真开始按「${plan.name}」注水`, 'info')
}

// ── 重量显示 ─────────────────────────────────────────────────────────
const weightText = computed(() => {
  const w = device.displayWeightG
  return (Math.abs(w) < 0.05 ? 0 : w).toFixed(1)
})
const weightClass = computed(() => {
  if (device.overload) return 'overload'
  if (Math.abs(device.displayWeightG) < 0.05) return 'zero'
  if (device.displayWeightG < 0) return 'neg'
  return ''
})

// ── 主计时按钮（状态驱动文案） ─────────────────────────────────────────
const mainBtnText = computed(() => {
  const st = session.session.state
  if (st === 'idle') return session.autoStart ? '预备（3s 后待注水）' : '开始计时'
  if (st === 'arming') return `预备中 ${session.armingCountdown}s（点击取消）`
  if (st === 'armed') return '待注水中（点击取消）'
  if (st === 'running') return '暂停'
  if (st === 'paused') return '继续'
  return '新的一杯'
})

const ratioText = computed(() => {
  const r = session.ratio
  return r == null ? '—' : `1:${r.toFixed(1)}`
})

// 图表计划：开始后用激活计划（跟踪进度），未开始用选中计划（预览目标曲线）
const chartPlan = computed(() => session.activePlan ?? session.selectedPlan)
const chartTargetCurve = computed(() => {
  const plan = chartPlan.value
  return plan ? targetCurve(plan.steps) : null
})

const fmtStep = (s: { label?: string; type: string; startS: number; endS: number; targetG?: number }) =>
  `${s.label ?? (s.type === 'pour' ? '注水' : '停顿')} · ${formatClock(s.startS)}–${formatClock(s.endS)}${s.targetG ? ` → ${s.targetG}g` : ''}`
</script>

<template>
  <!-- 未连接：连接引导 -->
  <div v-if="!device.isConnected" class="connect-card">
    <div class="connect-inner">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v3M7 21h10M5 8h14l-2 9H7L5 8z" stroke="var(--ac)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <h1>连接电子秤</h1>
      <p>支持 Timemore DOT（TES017）· 桌面版 Chrome</p>

      <!-- 连接失败详情：常驻展示，含阶段、原始错误与排查建议 -->
      <div v-if="connectError" class="connect-error" role="alert">
        <div class="ce-head">
          <span class="ce-title">连接失败</span>
          <button class="ce-close" type="button" aria-label="关闭错误提示" @click="connectError = null">×</button>
        </div>
        <p class="ce-msg">{{ connectError.message }}</p>
        <ol v-if="connectError.hints.length" class="ce-hints">
          <li v-for="(h, i) in connectError.hints" :key="i">{{ h }}</li>
        </ol>
        <button
          v-if="device.hasSelectedDevice"
          class="btn tiny"
          type="button"
          :disabled="connecting"
          @click="retryConnect()"
        >
          重试连接（不再选择设备）
        </button>
      </div>

      <div class="connect-actions">
        <button class="btn primary" :disabled="connecting" @click="connect(false)">
          {{ connecting ? '搜索中…' : '连接 DOT 秤' }}
        </button>
        <button class="btn" :disabled="connecting" @click="connect(true)">显示全部设备</button>
        <button class="btn ghost" :disabled="connecting" @click="connectSim()">启用仿真秤</button>
      </div>
      <p class="hint">搜索不到设备？长按秤上的蓝牙键进入广播模式后重试</p>
    </div>
  </div>

  <!-- 已连接 -->
  <div v-else class="weigh" :class="{ standard: mode === 'standard' }">
    <!-- 左栏：称量 -->
    <section class="pane scale-pane" aria-label="称量">
      <div class="weight-block">
        <div class="weight-label">重量</div>
        <div class="weight-value num" :class="weightClass">{{ weightText }}</div>
        <div class="weight-unit">g</div>
        <div v-if="device.overload" class="overload-tip">过载</div>
      </div>

      <!-- 标准模式：仅称重 + 去皮 -->
      <button v-if="mode === 'standard'" class="btn primary big" @click="device.tare()">去皮（Tare）</button>

      <!-- 手冲模式 -->
      <template v-else>
        <div class="timer-block">
          <div class="timer-label">计时</div>
          <div class="timer-value num" :class="{ on: session.running }">{{ session.timerText }}</div>
        </div>

        <div class="metrics">
          <div class="metric">
            <span class="m-label">流速</span>
            <span class="m-value num">{{ device.smoothedFlowGps.toFixed(1) }}</span>
            <span class="m-unit">g/s</span>
          </div>
          <div class="metric">
            <span class="m-label">注水量</span>
            <span class="m-value num">{{ session.waterG.toFixed(1) }}</span>
            <span class="m-unit">g</span>
          </div>
          <div class="metric">
            <span class="m-label">粉水比</span>
            <span class="m-value num">{{ ratioText }}</span>
          </div>
        </div>

        <!-- 咖啡粉 -->
        <div class="coffee-block">
          <template v-if="session.coffeeWeight">
            <label class="coffee-label" for="coffee-input">咖啡粉</label>
            <div class="coffee-row">
              <input
                id="coffee-input"
                class="coffee-input num"
                type="text"
                inputmode="decimal"
                :value="session.coffeeWeight"
                @change="session.setCoffee(Number(($event.target as HTMLInputElement).value))"
              />
              <span class="m-unit">g</span>
              <button class="btn tiny" type="button" @click="session.clearCoffee()">清除</button>
            </div>
          </template>
          <button v-else class="btn" type="button" @click="session.setCoffee()">设定咖啡粉（当前重量）</button>
        </div>

        <!-- 计时控制 -->
        <div class="controls">
          <button class="btn" @click="device.tare()">去皮</button>
          <button class="btn primary" @click="session.armOrStart()">{{ mainBtnText }}</button>
          <button
            class="btn"
            :disabled="!session.running && !session.paused"
            @click="session.pauseResume()"
          >
            {{ session.paused ? '继续' : '暂停' }}
          </button>
          <button
            class="btn"
            :disabled="!session.running && !session.paused"
            @click="session.stop()"
          >
            停止
          </button>
          <button class="btn ghost wide" :disabled="session.session.state === 'idle'" @click="session.reset()">重置</button>
        </div>

        <div class="auto-start-row">
          <ToggleSwitch v-model="session.autoStart" label="自动计时（注水自动开始）" />
          <span class="hint-inline">注水时自动开始计时；关闭后用按钮或双击空格开始</span>
        </div>

        <!-- 计划 -->
        <div class="plan-pick">
          <label class="m-label" for="plan-select">冲煮计划</label>
          <select id="plan-select" v-model="session.selectedPlanId" class="plan-select">
            <option :value="null">不使用计划</option>
            <option v-for="p in plans.list" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <button
            class="btn primary"
            :disabled="!session.selectedPlanId"
            @click="session.startWithPlan(session.selectedPlanId!)"
          >
            按计划开始
          </button>
        </div>
      </template>

      <!-- 仿真面板 -->
      <div v-if="device.isSimulator" class="sim-panel">
        <div class="sim-title">仿真注水</div>
        <label class="sim-row" for="sim-rate">
          <span>速率</span>
          <input id="sim-rate" v-model.number="simPourRate" type="range" min="-10" max="10" step="0.5" @input="applySimRate" />
          <span class="num">{{ simPourRate.toFixed(1) }} g/s</span>
        </label>
        <button class="btn tiny" @click="simPlayFullBrew()">按计划自动注水</button>
      </div>
    </section>

    <!-- 右栏：曲线 + 计划进度（仅手冲） -->
    <section v-if="mode === 'pour'" class="pane chart-pane" aria-label="冲煮曲线">
      <div class="chart-head">
        <span class="chart-title">冲煮曲线</span>
        <span v-if="chartTargetCurve" class="chart-legend">
          <span class="dash-sample" aria-hidden="true"></span>计划目标
        </span>
      </div>
      <BrewChart
        :samples="session.session.samples"
        :target-curve="chartTargetCurve"
        :steps="chartPlan?.steps ?? null"
        :live="session.running"
        :current-step="session.planProgress?.current ?? null"
        :height="300"
      />

      <div v-if="session.planProgress" class="plan-progress" :class="{ done: session.planProgress.done }">
        <template v-if="!session.planProgress.done">
          <div class="pp-row">
            <span class="pp-label">{{ session.planProgress.current ? '当前步骤' : '间隙' }}</span>
            <span class="pp-value">{{
              session.planProgress.current ? fmtStep(session.planProgress.current) : '等待下一阶段'
            }}</span>
          </div>
          <div v-if="session.planProgress.next" class="pp-row">
            <span class="pp-label">下一步</span>
            <span class="pp-value mute">{{ fmtStep(session.planProgress.next) }}</span>
          </div>
          <div class="pp-row">
            <span class="pp-label">目标 / 实际</span>
            <span class="pp-value num">
              {{ session.planProgress.targetG.toFixed(0) }}g / {{ session.waterG.toFixed(1) }}g
              <span :class="session.planProgress.deltaG >= 0 ? 'delta-pos' : 'delta-neg'">
                {{ session.planProgress.deltaG >= 0 ? '+' : '' }}{{ session.planProgress.deltaG.toFixed(1) }}
              </span>
            </span>
          </div>
        </template>
        <template v-else>
          <div class="pp-row">
            <span class="pp-label">状态</span>
            <span class="pp-value ok-text">冲煮计划已完成</span>
          </div>
        </template>
      </div>

      <div v-if="!chartPlan" class="chart-empty">
        <p>选择计划后这里会显示计划目标曲线</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 连接引导 */
.connect-card {
  display: grid;
  place-items: center;
  height: 100%;
}

.connect-inner {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.connect-inner h1 {
  font-size: 20px;
  font-weight: 400;
  color: var(--tx);
}

.connect-inner p {
  color: var(--tx-mute);
  font-size: 13px;
}

.connect-actions {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}

.hint {
  color: var(--tx-faint);
  font-size: 12px;
}

/* 连接失败卡片 */
.connect-error {
  width: 100%;
  max-width: 520px;
  border: 1px solid rgba(224, 85, 85, 0.45);
  background: rgba(224, 85, 85, 0.07);
  border-radius: 6px;
  padding: 12px 14px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ce-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ce-title {
  color: var(--err);
  font-size: 13px;
  letter-spacing: 0.1em;
}

.ce-close {
  color: var(--tx-mute);
  font-size: 16px;
  line-height: 1;
  padding: 0 4px;
}

.ce-close:hover {
  color: var(--tx);
}

.ce-msg {
  font-family: var(--num-font);
  font-size: 12px;
  color: var(--tx);
  word-break: break-word;
}

.ce-hints {
  margin: 0;
  padding-left: 1.35em;
  font-size: 12px;
  color: var(--tx-mute);
  line-height: 1.85;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ce-hints li::marker {
  color: var(--err);
}

.connect-error .btn {
  align-self: flex-start;
}

/* 布局 */
.weigh {
  display: grid;
  grid-template-columns: 400px 1fr;
  height: 100%;
}

.weigh.standard {
  grid-template-columns: 1fr;
  justify-items: center;
}

.pane {
  padding: 24px;
  overflow: auto;
}

.scale-pane {
  border-right: 1px solid var(--bd);
  display: flex;
  flex-direction: column;
  gap: 13px;
}

/* 高度不足时保持子项原尺寸，由 .pane 的 overflow: auto 负责滚动；
   否则默认 flex-shrink 会把模式切换按钮、指标条压扁并裁掉文字 */
.scale-pane > * {
  flex-shrink: 0;
}

.standard .scale-pane {
  border-right: none;
  max-width: 480px;
  width: 100%;
}

/* 重量大数字 */
.weight-block {
  text-align: center;
}

.weight-label {
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--tx-mute);
  text-transform: uppercase;
  margin-bottom: 6px;
}

.weight-value {
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 82px;
  font-weight: 300;
  line-height: 1;
  color: var(--tx);
}

.weight-value.zero {
  color: var(--tx-mute);
}

.weight-value.neg {
  color: var(--err);
}

.weight-value.overload {
  color: var(--err);
  text-decoration: underline wavy;
}

.weight-unit {
  font-size: 18px;
  color: var(--tx-mute);
  margin-top: 2px;
}

.overload-tip {
  color: var(--err);
  font-size: 12px;
  margin-top: 4px;
  letter-spacing: 0.2em;
}

/* 计时 */
.timer-block {
  text-align: center;
}

.timer-label {
  font-size: 11px;
  letter-spacing: 0.3em;
  color: var(--tx-mute);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.timer-value {
  font-size: 40px;
  letter-spacing: 0.06em;
  color: var(--tx-mute);
  transition: color 0.3s;
}

.timer-value.on {
  color: var(--ac);
}

/* 指标条 */
.metrics {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1px;
  background: var(--bd);
  border: 1px solid var(--bd);
  border-radius: 4px;
  overflow: hidden;
}

.metric {
  background: var(--bg-soft);
  padding: 10px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.m-label {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--tx-mute);
  text-transform: uppercase;
}

.m-value {
  font-size: 17px;
  color: var(--tx);
}

.m-unit {
  font-size: 10px;
  color: var(--tx-mute);
}

/* 咖啡粉 */
.coffee-block {
  border: 1px dashed var(--bd-strong);
  border-radius: 4px;
  padding: 12px;
}

.coffee-label {
  display: block;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--ac);
  text-transform: uppercase;
  margin-bottom: 6px;
}

.coffee-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coffee-input {
  width: 90px;
  background: var(--bg-raise);
  border: 1px solid var(--bd-strong);
  border-radius: 4px;
  color: var(--tx);
  padding: 6px 10px;
  font-size: 18px;
  text-align: center;
}

/* 计时控制 */
.controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.auto-start-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}

/* 说明文字单独成行，避免被挤压折行 */
.auto-start-row .hint-inline {
  flex-basis: 100%;
  white-space: nowrap;
}

.hint-inline {
  font-size: 11px;
  color: var(--tx-faint);
}

/* 计划选择 */
.plan-pick {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

.plan-select {
  background: var(--bg-soft);
  color: var(--tx);
  border: 1px solid var(--bd-strong);
  border-radius: 4px;
  padding: 8px 10px;
  font-size: 13px;
}

/* 仿真 */
.sim-panel {
  border: 1px solid rgba(122, 207, 224, 0.3);
  border-radius: 4px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sim-title {
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--info);
  text-transform: uppercase;
}

.sim-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--tx-mute);
}

.sim-row input[type='range'] {
  flex: 1;
  accent-color: var(--info);
}

/* 右栏 */
.chart-pane {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(22, 22, 22, 0.4);
}

.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-title {
  font-size: 13px;
  letter-spacing: 0.2em;
  color: var(--tx-mute);
  text-transform: uppercase;
}

.chart-legend {
  font-size: 11px;
  color: var(--tx-mute);
  display: flex;
  align-items: center;
  gap: 6px;
}

.dash-sample {
  width: 22px;
  height: 0;
  border-top: 2px dashed rgba(200, 169, 110, 0.55);
}

.chart-empty {
  display: grid;
  place-items: center;
  color: var(--tx-faint);
  font-size: 13px;
  flex: 1;
}

/* 计划进度卡 */
.plan-progress {
  border: 1px solid var(--bd);
  border-radius: 4px;
  background: var(--bg-soft);
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pp-row {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 13px;
}

.pp-label {
  color: var(--tx-mute);
  min-width: 72px;
  font-size: 12px;
}

.pp-value {
  color: var(--tx);
}

.pp-value.mute {
  color: var(--tx-mute);
}

.pp-value.ok-text {
  color: var(--ok);
}

.delta-pos {
  color: var(--warn);
  font-size: 12px;
}

.delta-neg {
  color: var(--info);
  font-size: 12px;
}

/* 通用按钮 */
.btn {
  padding: 10px 16px;
  border-radius: 4px;
  border: 1px solid var(--bd-strong);
  background: var(--bg-soft);
  color: var(--tx);
  font-size: 13px;
  transition: background 0.15s, border-color 0.15s;
}

.btn:hover:not(:disabled) {
  background: var(--bg-raise);
}

.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn.primary {
  background: var(--ac);
  border-color: var(--ac);
  color: #141414;
  font-weight: 600;
}

.btn.primary:hover:not(:disabled) {
  background: var(--ac-bright);
}

.btn.warn {
  background: rgba(224, 168, 68, 0.15);
  border-color: var(--warn);
  color: var(--warn);
}

.btn.ghost {
  border-color: transparent;
  color: var(--tx-mute);
}

.btn.big {
  padding: 16px;
  font-size: 15px;
  letter-spacing: 0.1em;
}

.btn.wide {
  grid-column: 1 / -1;
}

.btn.tiny {
  padding: 5px 10px;
  font-size: 12px;
}
</style>
