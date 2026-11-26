/**
 * 设备 store：真机（Web Bluetooth）与仿真秤统一管理，
 * 重量显示（软件去皮 offset + HW 去皮和解）、电量、信号丢失检测、流速 EMA 平滑。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ScaleClient, type ConnectionState, type DeviceInfo } from '../ble/scaleClient'
import { ScaleSimulator } from '../ble/simulator'
import type { Scale } from '../ble/scale'
import type { ScaleEvent } from '../ble/frames'

/** HW 去皮后等待秤归零的和解窗口（收到 |raw|<1g 的帧即清 offset） */
const TARE_SETTLE_MS = 5_000
/** 流速 EMA 平滑系数（10Hz 输入下约 0.8s 时间常数） */
const FLOW_EMA_ALPHA = 0.25
const SIGNAL_LOST_MS = 3_000
/** 连接后电量补读延迟：初始化读取只有一次，DOT 偶发不回，补读直到收到电量 */
const BATTERY_RETRY_DELAYS_MS = [800, 2_000, 4_000]
/** 连接期间电量刷新间隔：秤不主动上报变化时也能更新显示 */
const BATTERY_REFRESH_MS = 60_000

/**
 * 电量归一化：DOT 偶发只回格数、不回百分比（percent=0），
 * 用 4 格电量图标兜底，避免把「没读到百分比」显示成 0%。
 */
function normalizeBatteryPercent(bars: number, percent: number): number {
  const p = Math.min(100, Math.max(0, Math.round(percent)))
  if (p > 0) return p
  return bars > 0 ? Math.min(100, Math.round((bars / 4) * 100)) : 0
}

export const useDeviceStore = defineStore('device', () => {
  const connectionState = ref<ConnectionState>('disconnected')
  const deviceInfo = ref<DeviceInfo>({})
  const batteryBars = ref(0)
  /** null = 尚未读到（UI 显示「—」），避免把未知电量当成 0% */
  const batteryPercent = ref<number | null>(null)
  const overload = ref(false)
  const unit = ref<0 | 1>(0)
  const rawWeightG = ref(0)
  /** 软件去皮 offset；HW 去皮成功后与秤归零和解为 0 */
  const tareOffsetG = ref(0)
  const lastFrameAt = ref(0)
  const signalLost = ref(false)
  const isSimulator = ref(false)
  const simulatedPourRate = ref(0)

  const scale = ref<Scale | null>(null)
  let pendingTareSettleUntil = 0
  let signalTimer: ReturnType<typeof setInterval> | null = null
  let batteryRetryTimers: ReturnType<typeof setTimeout>[] = []
  let batteryRefreshTimer: ReturnType<typeof setInterval> | null = null
  /** 显示重量监听（session store 注册，转发采样） */
  const weightListeners = new Set<(displayW: number, flowGps: number) => void>()

  const displayWeightG = computed(() => rawWeightG.value - tareOffsetG.value)
  const isConnected = computed(() => connectionState.value === 'connected')
  /** 是否已选择过真机设备（失败后可用 reconnect 免选择器重试） */
  const hasSelectedDevice = computed(() => {
    const s = scale.value
    return !!s && !s.isSimulator && (s as ScaleClient).hasSelectedDevice
  })
  /** 平滑后的显示流速 g/s */
  const smoothedFlowGps = ref(0)

  const batteryText = computed(() => (batteryPercent.value == null ? '—' : `${batteryPercent.value}%`))
  const batteryTitle = computed(() =>
    batteryPercent.value == null ? '电量读取中' : `电量 ${batteryPercent.value}%`,
  )
  const batteryFillWidth = computed(() => {
    const p = batteryPercent.value
    return p == null ? 0 : Math.max(1, (p / 100) * 12)
  })
  const batteryColor = computed(() => {
    const p = batteryPercent.value
    if (p == null) return 'var(--tx-mute)'
    return p > 20 ? 'var(--ok)' : 'var(--err)'
  })

  function makeCallbacks(): ScaleClientCallbacksLike {
    return {
      onEvent: (e) => handleEvent(e),
      onStateChange: (s) => handleConnectionState(s),
      onDeviceInfo: (info) => (deviceInfo.value = info),
    }
  }

  interface ScaleClientCallbacksLike {
    onEvent: (e: ScaleEvent) => void
    onStateChange: (s: ConnectionState) => void
    onDeviceInfo: (info: DeviceInfo) => void
  }

  function ensureScale(): Scale {
    if (scale.value && (isSimulator.value ? scale.value.isSimulator : !scale.value.isSimulator)) {
      return scale.value
    }
    if (scale.value) void scale.value.disconnect()
    scale.value = isSimulator.value
      ? new ScaleSimulator((e) => handleEvent(e), (s) => handleConnectionState(s))
      : new ScaleClient(makeCallbacks())
    return scale.value
  }

  async function connectReal(opts: { showAllDevices?: boolean } = {}) {
    isSimulator.value = false
    const s = ensureScale()
    await s.connect(opts)
    startSignalWatch()
  }

  async function connectSim() {
    isSimulator.value = true
    const s = ensureScale()
    // 仿真秤没有 onDeviceInfo 回调，直接同步其静态信息
    deviceInfo.value = { ...s.info, modelMismatch: false }
    await s.connect()
    startSignalWatch()
  }

  async function reconnect() {
    await ensureScale().reconnect()
    startSignalWatch()
  }

  async function disconnect() {
    await scale.value?.disconnect()
  }

  function handleConnectionState(s: ConnectionState): void {
    connectionState.value = s
    if (s === 'connected') {
      startBatteryRefresh()
      return
    }
    stopBatteryRefresh()
    batteryPercent.value = null
    batteryBars.value = 0
    stopSignalWatch()
  }

  function clearBatteryRetries(): void {
    for (const t of batteryRetryTimers) clearTimeout(t)
    batteryRetryTimers = []
  }

  function stopBatteryRefresh(): void {
    clearBatteryRetries()
    if (batteryRefreshTimer) {
      clearInterval(batteryRefreshTimer)
      batteryRefreshTimer = null
    }
  }

  /** 连接后补读电量并每 60s 刷新；收到电量事件后停止补读 */
  function startBatteryRefresh(): void {
    stopBatteryRefresh()
    const s = scale.value
    if (!s) return
    for (const delay of BATTERY_RETRY_DELAYS_MS) {
      batteryRetryTimers.push(
        setTimeout(() => {
          if (batteryPercent.value == null) s.readBattery()
        }, delay),
      )
    }
    batteryRefreshTimer = setInterval(() => {
      if (connectionState.value === 'connected') s.readBattery()
    }, BATTERY_REFRESH_MS)
  }

  function handleEvent(e: ScaleEvent): void {
    switch (e.type) {
      case 'weight': {
        rawWeightG.value = e.weightG
        overload.value = e.overload
        lastFrameAt.value = Date.now()
        signalLost.value = false
        smoothedFlowGps.value = smoothedFlowGps.value * (1 - FLOW_EMA_ALPHA) + e.flowGps * FLOW_EMA_ALPHA
        if (pendingTareSettleUntil > 0 && Date.now() < pendingTareSettleUntil && Math.abs(e.weightG) < 1) {
          // 秤已自行归零，软件 offset 与之和 → 清零，避免双重去皮
          tareOffsetG.value = 0
          pendingTareSettleUntil = 0
        }
        const displayW = e.weightG - tareOffsetG.value
        for (const fn of weightListeners) fn(displayW, smoothedFlowGps.value)
        break
      }
      case 'battery':
        batteryBars.value = e.bars
        batteryPercent.value = normalizeBatteryPercent(e.bars, e.percent)
        clearBatteryRetries()
        break
      case 'unit':
        unit.value = e.unit
        break
      default:
        break
    }
  }

  /** 去皮：立即软件归零（显示 0）+ 硬件去皮镜像（成功后秤显示也归零） */
  async function tare(): Promise<void> {
    const raw = rawWeightG.value
    tareOffsetG.value = raw
    pendingTareSettleUntil = 0
    const s = scale.value
    if (!s || !s.isConnected) return
    const ok = await s.tare()
    if (ok) pendingTareSettleUntil = Date.now() + TARE_SETTLE_MS
  }

  function startSignalWatch(): void {
    stopSignalWatch()
    signalTimer = setInterval(() => {
      if (connectionState.value !== 'connected') return
      signalLost.value = Date.now() - lastFrameAt.value > SIGNAL_LOST_MS
    }, 1_000)
  }

  function stopSignalWatch(): void {
    if (signalTimer) clearInterval(signalTimer)
    signalTimer = null
    signalLost.value = false
  }

  /** 注册显示重量监听（每帧调用） */
  function onWeight(fn: (displayW: number, flowGps: number) => void): () => void {
    weightListeners.add(fn)
    return () => weightListeners.delete(fn)
  }

  return {
    connectionState,
    deviceInfo,
    batteryBars,
    batteryPercent,
    batteryText,
    batteryTitle,
    batteryFillWidth,
    batteryColor,
    overload,
    unit,
    rawWeightG,
    tareOffsetG,
    displayWeightG,
    smoothedFlowGps,
    lastFrameAt,
    signalLost,
    isSimulator,
    simulatedPourRate,
    isConnected,
    hasSelectedDevice,
    connectReal,
    connectSim,
    reconnect,
    disconnect,
    tare,
    onWeight,
    ensureScale,
  }
})
