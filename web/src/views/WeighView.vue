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
import { targetCurve, formatClock, planDurationS } from '../core/planModel'

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

// ── 冲煮配方 / 主按钮 ─────────────────────────────────────────────────
interface PlanSegment {
  type: 'pour' | 'pause'
  startS: number
  endS: number
  label?: string
  targetG?: number
}

const autoHintOpen = ref(false)
const canEditRecipe = computed(() => {
  const st = session.session.state
  return st === 'idle' || st === 'stopped'
})
const brewActive = computed(() => session.running || session.paused)
const coffeeText = computed(() => (session.coffeeWeight == null ? '' : session.coffeeWeight.toFixed(1)))

/** 选中计划的时间轴：把步骤之间的空档补成停顿，保证分段条连续 */
const planBar = computed(() => {
  const plan = session.selectedPlan
  if (!plan || plan.steps.length === 0) return null
  const totalS = planDurationS(plan.steps)
  if (totalS <= 0) return null

  const segs: PlanSegment[] = []
  let t = 0
  for (const s of plan.steps) {
    if (s.startS > t) segs.push({ type: 'pause', startS: t, endS: s.startS })
    const start = Math.max(t, s.startS)
    if (s.endS > start) {
      segs.push({ type: s.type, startS: start, endS: s.endS, label: s.label, targetG: s.targetG })
    }
    t = Math.max(t, s.endS)
  }

  const pours = plan.steps.filter((s) => s.type === 'pour').length
  const targetG = [...plan.steps].reverse().find((s) => s.type === 'pour')?.targetG ?? 0
  return { totalS, pours, targetG, segs }
})
const planSegments = computed(() => planBar.value?.segs ?? [])
const planPours = computed(() => planBar.value?.pours ?? 0)
const planTargetG = computed(() => planBar.value?.targetG ?? 0)
const planTotalText = computed(() => (planBar.value ? formatClock(planBar.value.totalS) : ''))
const planBarLabel = computed(() => {
  const bar = planBar.value
  const plan = session.selectedPlan
  if (!bar || !plan) return '自由冲煮'
  return `${plan.name}：${bar.pours} 段注水，目标 ${bar.targetG} 克，总时长 ${formatClock(bar.totalS)}`
})

/** 只有当前冲煮确实绑定了选中的计划时才画进度，避免手动开始也显示计划进度 */
const planBound = computed(() => {
  const sel = session.selectedPlan
  const act = session.activePlan
  return !!sel && !!act && sel.id === act.id
})
const planProgressActive = computed(
  () => planBound.value && (session.running || session.paused || session.stopped),
)
const planElapsedS = computed(() => (planProgressActive.value ? session.elapsedMs / 1000 : 0))
const playheadPct = computed(() => {
  const bar = planBar.value
  if (!bar || !planProgressActive.value) return 0
  return Math.min(planElapsedS.value / bar.totalS, 1) * 100
})

function segDone(seg: PlanSegment): boolean {
  return planProgressActive.value && seg.endS <= planElapsedS.value
}

function segTitle(seg: PlanSegment): string {
  const kind = seg.type === 'pour' ? '注水' : '停顿'
  const range = `${formatClock(seg.startS)}–${formatClock(seg.endS)}`
  return seg.targetG != null ? `${kind} ${range} → ${seg.targetG} g` : `${kind} ${range}`
}

const armProgress = computed(() => {
  if (!session.arming) return 1
  const total = session.session.config.armDelayMs
  return total > 0 ? Math.max(0, Math.min(1, session.armingRemainMs / total)) : 0
})

const primaryMain = computed(() => {
  const st = session.session.state
  if (st === 'arming') return `预备中 ${Math.max(1, session.armingCountdown)}`
  if (st === 'armed') return '等待注水'
  if (st === 'running') return '暂停'
  if (st === 'paused') return '继续'
  if (st === 'stopped') return '新的一杯'
  return session.autoStart ? '预备' : '开始计时'
})

const primarySub = computed(() => {
  const st = session.session.state
  if (st === 'arming' || st === 'armed') return '点击取消'
  if (st === 'running') return `已注水 ${session.waterG.toFixed(1)} g`
  if (st === 'paused') return `已暂停 ${session.timerText}`
  if (st === 'stopped') return session.autoStart ? '归零并重新预备' : '归零并立即计时'
  const plan = session.selectedPlan
  if (plan) return session.autoStart ? `${plan.name} · 3 秒后待注水` : `${plan.name} · 立即计时`
  return session.autoStart ? '3 秒后待注水' : '立即开始 · 双击空格亦可'
})

/** 手动改粉量只更新数值；去皮发生在「设为当前重量」 */
function onCoffeeChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const v = Number(input.value)
  if (!Number.isFinite(v) || v <= 0) {
    session.clearCoffee()
    input.value = ''
    return
  }
  session.updateCoffee(v)
}

const ratioText = computed(() => {
  const r = session.ratio
  return r == null || r <= 0 ? '—' : `1:${r.toFixed(1)}`
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

      <!-- 标准模式：仅称重 + 归零 -->
      <button v-if="mode === 'standard'" class="btn primary big" @click="device.tare()">归零</button>

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

        <!-- 冲煮配方 -->
        <div class="recipe-card">
          <div class="recipe-head"><span class="recipe-title">冲煮配方</span></div>

          <div class="r-row">
            <span class="r-label">咖啡粉</span>
            <div v-if="session.coffeeWeight != null" class="dose-field">
              <input
                id="coffee-input"
                class="dose-input num"
                type="text"
                inputmode="decimal"
                :value="coffeeText"
                aria-label="咖啡粉克重"
                autocomplete="off"
                @change="onCoffeeChange"
              />
              <span class="dose-unit">g</span>
              <button class="icon-btn" type="button" aria-label="清除咖啡粉克重" @click="session.clearCoffee()">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" /></svg>
              </button>
            </div>
            <button v-else class="dose-set" type="button" :disabled="!canEditRecipe" @click="session.setCoffee()">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M6 2v8M2 6h8" /></svg>
              设为当前重量
            </button>
          </div>

          <div class="r-row">
            <span class="r-label">计划</span>
            <div class="select-wrap">
              <select
                v-model="session.selectedPlanId"
                class="plan-select"
                :disabled="!canEditRecipe"
                aria-label="冲煮计划"
              >
                <option :value="null">不使用计划</option>
                <option v-for="p in plans.list" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
            </div>
          </div>

          <div v-if="planBar" class="plan-bar" :class="{ active: planProgressActive }" role="img" :aria-label="planBarLabel">
            <span
              v-for="(seg, i) in planSegments"
              :key="i"
              class="seg"
              :class="[seg.type, { done: segDone(seg) }]"
              :style="{ flexGrow: seg.endS - seg.startS }"
              :title="segTitle(seg)"
            ></span>
            <span class="playhead" :style="{ left: `${playheadPct}%` }" aria-hidden="true"></span>
          </div>
          <div class="plan-meta">
            <span>{{ planBar ? `${planPours} 段注水` : '自由冲煮 · 仅计时' }}</span>
            <span v-if="planBar" class="num">目标 <strong>{{ planTargetG }} g</strong> · {{ planTotalText }}</span>
          </div>
        </div>

        <!-- 主操作：绑定选中计划后预备；运行中暂停，预备中取消 -->
        <button
          class="primary-action"
          :class="{ live: session.running, arming: session.arming }"
          type="button"
          @click="session.primaryAction()"
        >
          <span class="p-main">{{ primaryMain }}</span>
          <span class="p-sub">{{ primarySub }}</span>
          <span class="p-progress" aria-hidden="true"><i :style="{ transform: `scaleX(${armProgress})` }"></i></span>
        </button>

        <!-- 次级操作：冲煮中只保留停止，其余状态是归零 + 自动计时 -->
        <div class="secondary">
          <template v-if="brewActive">
            <button class="stop-btn" type="button" @click="session.stop()">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2" y="2" width="8" height="8" rx="1.2" /></svg>
              停止并保存
            </button>
          </template>
          <template v-else>
            <button class="tare" type="button" :disabled="session.arming || session.armed" @click="device.tare()">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v7.5" /><path d="M5.4 7.4 8 10l2.6-2.6" /><path d="M3 13.5h10" /></svg>
              归零
            </button>
            <div class="auto">
              <ToggleSwitch v-model="session.autoStart" label="注水自动开始" />
              <button
                class="help"
                type="button"
                aria-label="自动计时说明"
                aria-controls="auto-hint"
                :aria-expanded="autoHintOpen"
                @click="autoHintOpen = !autoHintOpen"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.3" /><path d="M6.4 6.2a1.7 1.7 0 1 1 2.3 1.6c-.5.2-.7.6-.7 1.1v.3" /><circle cx="8" cy="11.3" r="0.55" fill="currentColor" stroke="none" /></svg>
              </button>
            </div>
          </template>
        </div>
        <p id="auto-hint" v-show="autoHintOpen && !brewActive" class="hint-inline">
          注水时自动开始计时。关闭后，可用主按钮或双击空格开始。
        </p>
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
  /* 左栏标签在暗底上的可读性：比全局 faint/mute 提亮一档 */
  --tx-mute: #a09a90;
  --tx-faint: #8a847a;
  --tx-2: #c3bdb2;
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
  gap: 16px;
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
  font-size: 12px;
  letter-spacing: 0.24em;
  color: var(--tx-faint);
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
  font-size: 12px;
  letter-spacing: 0.24em;
  color: var(--tx-faint);
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
  padding: 10px 6px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.m-label {
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--tx-mute);
  text-transform: uppercase;
}

.m-value {
  font-size: 17px;
  color: var(--tx);
}

.m-unit {
  font-size: 12px;
  color: var(--tx-faint);
}

/* 冲煮配方卡 */
.recipe-card {
  padding: 12px 14px 11px;
  background: #121212;
  border: 1px solid #232323;
  border-radius: 6px;
}

.recipe-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 8px;
}

.recipe-title {
  font-size: 12px;
  letter-spacing: 0.18em;
  color: var(--tx-faint);
  white-space: nowrap;
}

.recipe-head::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #1f1f1f;
}

.r-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
}

.r-label {
  width: 50px;
  flex: none;
  font-size: 12px;
  color: var(--tx-mute);
}

.dose-field {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.dose-input {
  width: 72px;
  margin-left: -6px;
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  font-size: 20px;
  letter-spacing: 0.02em;
  color: var(--tx);
  transition: background 0.15s;
}

.dose-input:hover {
  background: #191919;
}

.dose-input:focus-visible {
  outline: 2px solid var(--ac);
  outline-offset: 1px;
}

.dose-unit {
  font-size: 12px;
  color: var(--tx-faint);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-left: auto;
  border-radius: 4px;
  color: var(--tx-faint);
  transition: background 0.15s, color 0.15s;
}

.icon-btn:hover {
  background: #191919;
  color: var(--tx);
}

.dose-set {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: -8px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--ac);
  transition: background 0.15s;
}

.dose-set:hover:not(:disabled) {
  background: rgba(200, 169, 110, 0.08);
}

.dose-set:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.select-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.plan-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  margin-left: -6px;
  padding: 5px 24px 5px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  font-size: 13px;
  color: var(--tx);
  cursor: pointer;
  transition: background 0.15s;
}

.plan-select:hover:not(:disabled) {
  background: #191919;
}

.plan-select:focus-visible {
  outline: 2px solid var(--ac);
  outline-offset: 1px;
}

.plan-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plan-select:disabled + svg {
  opacity: 0.5;
}

.select-wrap svg {
  position: absolute;
  right: 4px;
  color: var(--tx-mute);
  pointer-events: none;
}

.plan-bar {
  position: relative;
  display: flex;
  gap: 2px;
  height: 6px;
  margin-top: 10px;
  border-radius: 3px;
  background: #191919;
}

.seg {
  flex: 1 1 0;
  border-radius: 2px;
}

.seg.pour {
  background: #6f5c3b;
}

.seg.pour.done {
  background: var(--ac);
}

.seg.pause {
  background: repeating-linear-gradient(135deg, #2b2b2b 0 3px, #1b1b1b 3px 5px);
}

.playhead {
  position: absolute;
  top: -3px;
  left: 0;
  display: none;
  width: 2px;
  height: 12px;
  border-radius: 1px;
  background: var(--tx);
  box-shadow: 0 0 8px rgba(240, 236, 228, 0.45);
  transform: translateX(-1px);
  transition: left 0.1s linear;
}

.plan-bar.active .playhead {
  display: block;
}

.plan-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-top: 7px;
  font-size: 12px;
  color: var(--tx-faint);
}

.plan-meta .num {
  font-size: 12px;
  color: var(--tx-mute);
}

.plan-meta strong {
  font-weight: 400;
  color: var(--tx-2);
}

/* 主操作 */
.primary-action {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: 100%;
  min-height: 62px;
  padding: 8px 16px 9px;
  overflow: hidden;
  border: 1px solid #d3b57c;
  border-radius: 6px;
  background: linear-gradient(180deg, #cfb077, #c3a263);
  color: #17130b;
  box-shadow: 0 10px 26px rgba(200, 169, 110, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition: background 0.18s, border-color 0.18s, color 0.18s, box-shadow 0.18s;
}

.primary-action:hover {
  background: linear-gradient(180deg, #dcc08a, #cdae72);
}

.primary-action:active {
  transform: translateY(1px);
}

.primary-action:focus-visible {
  outline-color: var(--tx);
}

.p-main {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.03em;
}

.p-sub {
  font-size: 12px;
  line-height: 1.35;
  color: rgba(23, 19, 11, 0.82);
}

/* 冲煮进行中：主按钮退为暗金（动作是暂停） */
.primary-action.live {
  border-color: #4b3f2a;
  background: #221d14;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #f2e5c8;
}

.primary-action.live:hover {
  background: #2a2318;
  border-color: #5c4d33;
}

.primary-action.live .p-sub {
  color: #c0ac86;
}

.p-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  display: none;
  width: 100%;
  height: 3px;
  background: rgba(23, 19, 11, 0.16);
}

.primary-action.arming .p-progress {
  display: block;
}

.p-progress i {
  display: block;
  width: 100%;
  height: 100%;
  background: #17130b;
  transform-origin: left center;
  transition: transform 0.1s linear;
}

/* 次级操作 */
.secondary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 36px;
}

.tare {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  min-width: 82px;
  padding: 0 13px;
  border: 1px solid rgba(200, 169, 110, 0.42);
  border-radius: 5px;
  background: rgba(200, 169, 110, 0.08);
  font-size: 13px;
  font-weight: 500;
  color: #dbc493;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  transition: background 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s;
}

.tare:hover:not(:disabled) {
  border-color: rgba(200, 169, 110, 0.7);
  background: rgba(200, 169, 110, 0.15);
  color: #f0dfb9;
}

.tare:active:not(:disabled) {
  transform: translateY(1px);
}

.tare:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.auto {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.auto :deep(.switch-label) {
  font-size: 12px;
}

.help {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--tx-faint);
  transition: color 0.15s;
}

.help:hover {
  color: var(--tx-2);
}

.stop-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
  height: 38px;
  border: 1px solid #3a3a3a;
  border-radius: 5px;
  font-size: 13px;
  color: #e8e3d9;
  transition: background 0.15s, border-color 0.15s;
}

.stop-btn:hover {
  background: var(--bg-soft);
  border-color: #4a4a4a;
}

.stop-btn svg {
  color: var(--tx-mute);
}

.hint-inline {
  margin-top: -8px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--tx-faint);
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

.btn.tiny {
  padding: 5px 10px;
  font-size: 12px;
}
</style>
