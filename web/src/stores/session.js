/**
 * 冲煮会话 store：桥接设备采样流到 BrewSession 状态机，
 * 管理计时显示、粉水比、冲煮计划执行跟踪与自动保存。
 */
import { computed, reactive, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { BrewSession } from '../core/brewSession';
import { stepAt, targetAt } from '../core/planModel';
import { api } from '../api/client';
import { useDeviceStore } from './device';
import { usePlansStore } from './plans';
import { useToastStore } from './toast';
/** 空格键双击开始计时（手动模式）判定窗口 */
export const SPACE_DOUBLE_TAP_MS = 600;
export const useSessionStore = defineStore('session', () => {
    const device = useDeviceStore();
    const plans = usePlansStore();
    const toast = useToastStore();
    const session = reactive(new BrewSession());
    const nowMs = ref(Date.now());
    const autoStart = ref(localStorage.getItem('autoStart') !== '0');
    const selectedPlanId = ref(null);
    const armingCountdown = ref(0);
    // ── 采样桥接 ─────────────────────────────────────────────────────────
    device.onWeight((displayW, flow) => {
        session.onSample(Date.now(), displayW, flow);
    });
    // ── 计时显示 tick ────────────────────────────────────────────────────
    let tickTimer = null;
    watch(() => session.state, (s) => {
        const running = s === 'running' || s === 'arming' || s === 'armed';
        if (running && !tickTimer) {
            tickTimer = setInterval(() => {
                nowMs.value = Date.now();
                armingCountdown.value = Math.ceil(session.armingRemainMs(nowMs.value) / 1000);
            }, 100);
        }
        else if (!running && tickTimer) {
            clearInterval(tickTimer);
            tickTimer = null;
            armingCountdown.value = 0;
        }
    }, { immediate: true });
    watch(autoStart, (v) => localStorage.setItem('autoStart', v ? '1' : '0'));
    const elapsedMs = computed(() => session.elapsedMs(nowMs.value));
    const timerText = computed(() => {
        const ms = elapsedMs.value;
        const m = String(Math.floor(ms / 60000)).padStart(2, '0');
        const s = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
        const d = Math.floor(ms / 100) % 10;
        return `${m}:${s}.${d}`;
    });
    const running = computed(() => session.state === 'running');
    const paused = computed(() => session.state === 'paused');
    const armed = computed(() => session.state === 'armed');
    const arming = computed(() => session.state === 'arming');
    const stopped = computed(() => session.state === 'stopped');
    // ── 粉水比 ───────────────────────────────────────────────────────────
    const coffeeWeight = computed(() => session.coffeeWeight);
    const waterG = computed(() => Math.max(0, device.displayWeightG));
    const ratio = computed(() => {
        const c = session.coffeeWeight;
        if (!c || c <= 0)
            return null;
        return waterG.value / c;
    });
    /** 设定咖啡粉：记录当前显示重量为粉量，随即去皮（此后显示重量 = 注水量） */
    async function setCoffee(weightOverride) {
        const w = weightOverride ?? device.displayWeightG;
        if (!(w > 0)) {
            toast.push('当前重量为 0，请先把咖啡粉放上秤再设定（或手动输入粉量）', 'warn');
            return;
        }
        session.coffeeWeight = w;
        await device.tare();
    }
    function clearCoffee() {
        session.coffeeWeight = null;
    }
    // ── 计划执行 ─────────────────────────────────────────────────────────
    const activePlan = computed(() => {
        if (session.planId == null)
            return null;
        return plans.list.find((p) => p.id === session.planId) ?? null;
    });
    const selectedPlan = computed(() => {
        if (selectedPlanId.value == null)
            return null;
        return plans.list.find((p) => p.id === selectedPlanId.value) ?? null;
    });
    const planProgress = computed(() => {
        const plan = activePlan.value;
        if (!plan)
            return null;
        const tS = elapsedMs.value / 1000;
        const { current, next, done } = stepAt(plan.steps, tS);
        return {
            current,
            next,
            done,
            targetG: targetAt(plan.steps, tS),
            deltaG: waterG.value - targetAt(plan.steps, tS),
            totalS: plan.steps.reduce((m, s) => Math.max(m, s.endS), 0),
        };
    });
    // ── 计时控制 ─────────────────────────────────────────────────────────
    /** 预备（自动计时开）：3s 后待注水；自动计时关：直接开始；stopped：先重置再来 */
    function armOrStart() {
        if (session.state === 'stopped') {
            session.reset();
        }
        if (session.state === 'arming' || session.state === 'armed') {
            session.cancelArm();
            return;
        }
        if (session.state === 'running')
            return;
        if (session.state === 'paused')
            return session.resume(Date.now());
        if (autoStart.value) {
            session.arm(Date.now(), device.displayWeightG);
            armingCountdown.value = Math.ceil(session.config.armDelayMs / 1000);
        }
        else {
            session.startTimer(Date.now());
        }
    }
    function startManual() {
        if (session.state === 'idle' || session.state === 'armed') {
            if (autoStart.value && session.state === 'armed')
                return; // armed 等注水即可
            session.startTimer(Date.now());
        }
    }
    function pauseResume() {
        if (session.state === 'running')
            session.pauseTimer(Date.now());
        else if (session.state === 'paused')
            session.resume(Date.now());
    }
    /** 停止计时并尝试保存记录 */
    async function stop() {
        if (session.state === 'running' || session.state === 'paused') {
            session.stop(Date.now());
            await trySave();
            if (planProgress.value?.done)
                toast.push('冲煮计划完成，记录已保存', 'ok');
            else
                toast.push('计时已停止', 'info');
        }
    }
    /** 重置（若仍在计时先停止并保存） */
    async function reset() {
        if (session.state === 'running' || session.state === 'paused') {
            session.stop(Date.now());
            await trySave();
        }
        session.reset();
        armingCountdown.value = 0;
    }
    /** 按计划开始：绑定计划后预备 */
    /** 按计划开始：绑定计划后预备（保留已设定的咖啡粉量） */
    function startWithPlan(planId) {
        if (session.state === 'running' || session.state === 'paused') {
            toast.push('请先停止或重置当前计时', 'warn');
            return;
        }
        const coffee = session.coffeeWeight;
        session.reset();
        session.coffeeWeight = coffee;
        session.planId = planId;
        selectedPlanId.value = planId;
        armOrStart();
    }
    async function trySave() {
        if (!session.isSavable())
            return;
        try {
            const payload = session.buildSavePayload(device.deviceInfo.scaleName ?? device.deviceInfo.bleName ?? '');
            await api.recordSave(payload);
            toast.push('冲煮记录已保存', 'ok');
        }
        catch (e) {
            toast.push(`保存失败: ${e.message}`, 'err');
        }
    }
    return {
        session,
        autoStart,
        selectedPlanId,
        armingCountdown,
        elapsedMs,
        timerText,
        running,
        paused,
        armed,
        arming,
        stopped,
        coffeeWeight,
        waterG,
        ratio,
        activePlan,
        selectedPlan,
        planProgress,
        armOrStart,
        startManual,
        pauseResume,
        stop,
        reset,
        setCoffee,
        clearCoffee,
        startWithPlan,
        trySave,
    };
});
