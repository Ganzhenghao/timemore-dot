/**
 * 设备 store：真机（Web Bluetooth）与仿真秤统一管理，
 * 重量显示（软件去皮 offset + HW 去皮和解）、电量、信号丢失检测、流速 EMA 平滑。
 */
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { ScaleClient } from '../ble/scaleClient';
import { ScaleSimulator } from '../ble/simulator';
/** HW 去皮后等待秤归零的和解窗口（收到 |raw|<1g 的帧即清 offset） */
const TARE_SETTLE_MS = 5_000;
/** 流速 EMA 平滑系数（10Hz 输入下约 0.8s 时间常数） */
const FLOW_EMA_ALPHA = 0.25;
const SIGNAL_LOST_MS = 3_000;
export const useDeviceStore = defineStore('device', () => {
    const connectionState = ref('disconnected');
    const deviceInfo = ref({});
    const batteryBars = ref(0);
    const batteryPercent = ref(0);
    const overload = ref(false);
    const unit = ref(0);
    const rawWeightG = ref(0);
    /** 软件去皮 offset；HW 去皮成功后与秤归零和解为 0 */
    const tareOffsetG = ref(0);
    const lastFrameAt = ref(0);
    const signalLost = ref(false);
    const isSimulator = ref(false);
    const simulatedPourRate = ref(0);
    const scale = ref(null);
    let pendingTareSettleUntil = 0;
    let signalTimer = null;
    /** 显示重量监听（session store 注册，转发采样） */
    const weightListeners = new Set();
    const displayWeightG = computed(() => rawWeightG.value - tareOffsetG.value);
    const isConnected = computed(() => connectionState.value === 'connected');
    /** 平滑后的显示流速 g/s */
    const smoothedFlowGps = ref(0);
    function makeCallbacks() {
        return {
            onEvent: (e) => handleEvent(e),
            onStateChange: (s) => {
                connectionState.value = s;
                if (s !== 'connected')
                    stopSignalWatch();
            },
            onDeviceInfo: (info) => (deviceInfo.value = info),
        };
    }
    function ensureScale() {
        if (scale.value && (isSimulator.value ? scale.value.isSimulator : !scale.value.isSimulator)) {
            return scale.value;
        }
        if (scale.value)
            void scale.value.disconnect();
        scale.value = isSimulator.value
            ? new ScaleSimulator((e) => handleEvent(e), (s) => (connectionState.value = s))
            : new ScaleClient(makeCallbacks());
        return scale.value;
    }
    async function connectReal(opts = {}) {
        isSimulator.value = false;
        const s = ensureScale();
        await s.connect(opts);
        startSignalWatch();
    }
    async function connectSim() {
        isSimulator.value = true;
        const s = ensureScale();
        // 仿真秤没有 onDeviceInfo 回调，直接同步其静态信息
        deviceInfo.value = { ...s.info, modelMismatch: false };
        await s.connect();
        startSignalWatch();
    }
    async function reconnect() {
        await ensureScale().reconnect();
        startSignalWatch();
    }
    async function disconnect() {
        await scale.value?.disconnect();
    }
    function handleEvent(e) {
        switch (e.type) {
            case 'weight': {
                rawWeightG.value = e.weightG;
                overload.value = e.overload;
                lastFrameAt.value = Date.now();
                signalLost.value = false;
                smoothedFlowGps.value = smoothedFlowGps.value * (1 - FLOW_EMA_ALPHA) + e.flowGps * FLOW_EMA_ALPHA;
                if (pendingTareSettleUntil > 0 && Date.now() < pendingTareSettleUntil && Math.abs(e.weightG) < 1) {
                    // 秤已自行归零，软件 offset 与之和 → 清零，避免双重去皮
                    tareOffsetG.value = 0;
                    pendingTareSettleUntil = 0;
                }
                const displayW = e.weightG - tareOffsetG.value;
                for (const fn of weightListeners)
                    fn(displayW, smoothedFlowGps.value);
                break;
            }
            case 'battery':
                batteryBars.value = e.bars;
                batteryPercent.value = e.percent;
                break;
            case 'unit':
                unit.value = e.unit;
                break;
            default:
                break;
        }
    }
    /** 去皮：立即软件归零（显示 0）+ 硬件去皮镜像（成功后秤显示也归零） */
    async function tare() {
        const raw = rawWeightG.value;
        tareOffsetG.value = raw;
        pendingTareSettleUntil = 0;
        const s = scale.value;
        if (!s || !s.isConnected)
            return;
        const ok = await s.tare();
        if (ok)
            pendingTareSettleUntil = Date.now() + TARE_SETTLE_MS;
    }
    function startSignalWatch() {
        stopSignalWatch();
        signalTimer = setInterval(() => {
            if (connectionState.value !== 'connected')
                return;
            signalLost.value = Date.now() - lastFrameAt.value > SIGNAL_LOST_MS;
        }, 1_000);
    }
    function stopSignalWatch() {
        if (signalTimer)
            clearInterval(signalTimer);
        signalTimer = null;
        signalLost.value = false;
    }
    /** 注册显示重量监听（每帧调用） */
    function onWeight(fn) {
        weightListeners.add(fn);
        return () => weightListeners.delete(fn);
    }
    return {
        connectionState,
        deviceInfo,
        batteryBars,
        batteryPercent,
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
        connectReal,
        connectSim,
        reconnect,
        disconnect,
        tare,
        onWeight,
        ensureScale,
    };
});
