import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useDeviceStore } from '../stores/device';
import { useSessionStore, SPACE_DOUBLE_TAP_MS } from '../stores/session';
import { usePlansStore } from '../stores/plans';
import { useToastStore } from '../stores/toast';
import BrewChart from '../components/BrewChart.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import { targetCurve, formatClock } from '../core/planModel';
const device = useDeviceStore();
const session = useSessionStore();
const plans = usePlansStore();
const toast = useToastStore();
const mode = ref(localStorage.getItem('mode') || 'pour');
function setMode(m) {
    if (session.running || session.paused) {
        toast.push('请先停止当前计时再切换模式', 'warn');
        return;
    }
    mode.value = m;
    localStorage.setItem('mode', m);
}
// ── 双击空格开始计时（手动触发，两种自动模式都可用） ──────────────────────
let lastSpaceAt = 0;
function onKeydown(e) {
    if (e.code !== 'Space')
        return;
    const t = e.target;
    if (t.closest('input, textarea, select, [contenteditable], [role="switch"]'))
        return;
    const now = Date.now();
    if (now - lastSpaceAt <= SPACE_DOUBLE_TAP_MS) {
        e.preventDefault();
        lastSpaceAt = 0;
        if (session.session.state === 'idle' || session.session.state === 'stopped') {
            session.startManual();
            toast.push('计时已开始', 'info');
        }
    }
    else {
        lastSpaceAt = now;
    }
}
onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
// ── 连接 ─────────────────────────────────────────────────────────────
const connecting = ref(false);
async function connect(showAll = false) {
    connecting.value = true;
    try {
        await device.connectReal({ showAllDevices: showAll });
        toast.push('秤已连接', 'ok');
    }
    catch (e) {
        const msg = e.message ?? '';
        if (!/cancel|取消/i.test(msg))
            toast.push(`连接失败: ${msg}`, 'err');
    }
    finally {
        connecting.value = false;
    }
}
async function connectSim() {
    try {
        await device.connectSim();
        toast.push('仿真秤已启用', 'ok');
    }
    catch (e) {
        toast.push(`仿真启动失败: ${e.message}`, 'err');
    }
}
// ── 仿真控制 ─────────────────────────────────────────────────────────
const simPourRate = ref(0);
function applySimRate() {
    const s = device.ensureScale();
    s.setPourRate(simPourRate.value);
}
function simPlayFullBrew() {
    const plan = session.selectedPlan ?? plans.list[0];
    if (!plan) {
        toast.push('请先创建冲煮计划', 'warn');
        return;
    }
    const s = device.ensureScale();
    // 按计划的注水步骤生成注水脚本：速率 = 段注水量 / 段时长
    const script = [];
    let prev = 0;
    for (const st of plan.steps) {
        if (st.type === 'pour') {
            const amount = (st.targetG ?? 0) - prev;
            const durS = st.endS - st.startS;
            if (amount > 0 && durS > 0)
                script.push({ rateGps: amount / durS, durMs: durS * 1000 });
            prev = st.targetG ?? prev;
        }
    }
    s.playScript(script);
    toast.push(`仿真开始按「${plan.name}」注水`, 'info');
}
// ── 重量显示 ─────────────────────────────────────────────────────────
const weightText = computed(() => {
    const w = device.displayWeightG;
    return (Math.abs(w) < 0.05 ? 0 : w).toFixed(1);
});
const weightClass = computed(() => {
    if (device.overload)
        return 'overload';
    if (Math.abs(device.displayWeightG) < 0.05)
        return 'zero';
    if (device.displayWeightG < 0)
        return 'neg';
    return '';
});
// ── 主计时按钮（状态驱动文案） ─────────────────────────────────────────
const mainBtnText = computed(() => {
    const st = session.session.state;
    if (st === 'idle')
        return session.autoStart ? '预备（3s 后待注水）' : '开始计时';
    if (st === 'arming')
        return `预备中 ${session.armingCountdown}s（点击取消）`;
    if (st === 'armed')
        return '待注水中（点击取消）';
    if (st === 'running')
        return '暂停';
    if (st === 'paused')
        return '继续';
    return '新的一杯';
});
const ratioText = computed(() => {
    const r = session.ratio;
    return r == null ? '—' : `1:${r.toFixed(1)}`;
});
// 图表计划：开始后用激活计划（跟踪进度），未开始用选中计划（预览目标曲线）
const chartPlan = computed(() => session.activePlan ?? session.selectedPlan);
const chartTargetCurve = computed(() => {
    const plan = chartPlan.value;
    return plan ? targetCurve(plan.steps) : null;
});
const fmtStep = (s) => `${s.label ?? (s.type === 'pour' ? '注水' : '停顿')} · ${formatClock(s.startS)}–${formatClock(s.endS)}${s.targetG ? ` → ${s.targetG}g` : ''}`;
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['connect-inner']} */ ;
/** @type {__VLS_StyleScopedClasses['connect-inner']} */ ;
/** @type {__VLS_StyleScopedClasses['weigh']} */ ;
/** @type {__VLS_StyleScopedClasses['standard']} */ ;
/** @type {__VLS_StyleScopedClasses['scale-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['weight-value']} */ ;
/** @type {__VLS_StyleScopedClasses['weight-value']} */ ;
/** @type {__VLS_StyleScopedClasses['weight-value']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-value']} */ ;
/** @type {__VLS_StyleScopedClasses['auto-start-row']} */ ;
/** @type {__VLS_StyleScopedClasses['hint-inline']} */ ;
/** @type {__VLS_StyleScopedClasses['sim-row']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-value']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-value']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
if (!__VLS_ctx.device.isConnected) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "connect-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "connect-inner" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
        width: "44",
        height: "44",
        viewBox: "0 0 24 24",
        fill: "none",
        'aria-hidden': "true",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
        d: "M12 3v3M7 21h10M5 8h14l-2 9H7L5 8z",
        stroke: "var(--ac)",
        'stroke-width': "1.4",
        'stroke-linecap': "round",
        'stroke-linejoin': "round",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "connect-actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.device.isConnected))
                    return;
                __VLS_ctx.connect(false);
            } },
        ...{ class: "btn primary" },
        disabled: (__VLS_ctx.connecting),
    });
    (__VLS_ctx.connecting ? '搜索中…' : '连接 DOT 秤');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.device.isConnected))
                    return;
                __VLS_ctx.connect(true);
            } },
        ...{ class: "btn" },
        disabled: (__VLS_ctx.connecting),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.device.isConnected))
                    return;
                __VLS_ctx.connectSim();
            } },
        ...{ class: "btn ghost" },
        disabled: (__VLS_ctx.connecting),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "hint" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "weigh" },
        ...{ class: ({ standard: __VLS_ctx.mode === 'standard' }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "pane scale-pane" },
        'aria-label': "称量",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "mode-switch" },
        role: "radiogroup",
        'aria-label': "模式切换",
    });
    for (const [m] of __VLS_getVForSourceType(['pour', 'standard'])) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.device.isConnected))
                        return;
                    __VLS_ctx.setMode(m);
                } },
            key: (m),
            type: "button",
            role: "radio",
            'aria-checked': (__VLS_ctx.mode === m),
            ...{ class: "mode-btn" },
            ...{ class: ({ active: __VLS_ctx.mode === m }) },
        });
        (m === 'pour' ? '手冲' : '标准');
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "weight-block" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "weight-label" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "weight-value num" },
        ...{ class: (__VLS_ctx.weightClass) },
    });
    (__VLS_ctx.weightText);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "weight-unit" },
    });
    if (__VLS_ctx.device.overload) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "overload-tip" },
        });
    }
    if (__VLS_ctx.mode === 'standard') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.device.isConnected))
                        return;
                    if (!(__VLS_ctx.mode === 'standard'))
                        return;
                    __VLS_ctx.device.tare();
                } },
            ...{ class: "btn primary big" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "timer-block" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "timer-label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "timer-value num" },
            ...{ class: ({ on: __VLS_ctx.session.running }) },
        });
        (__VLS_ctx.session.timerText);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "metrics" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "metric" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "m-label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "m-value num" },
        });
        (__VLS_ctx.device.smoothedFlowGps.toFixed(1));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "m-unit" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "metric" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "m-label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "m-value num" },
        });
        (__VLS_ctx.session.waterG.toFixed(1));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "m-unit" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "metric" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "m-label" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "m-value num" },
        });
        (__VLS_ctx.ratioText);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "coffee-block" },
        });
        if (__VLS_ctx.session.coffeeWeight) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
                ...{ class: "coffee-label" },
                for: "coffee-input",
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "coffee-row" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                ...{ onChange: (...[$event]) => {
                        if (!!(!__VLS_ctx.device.isConnected))
                            return;
                        if (!!(__VLS_ctx.mode === 'standard'))
                            return;
                        if (!(__VLS_ctx.session.coffeeWeight))
                            return;
                        __VLS_ctx.session.setCoffee(Number($event.target.value));
                    } },
                id: "coffee-input",
                ...{ class: "coffee-input num" },
                type: "text",
                inputmode: "decimal",
                value: (__VLS_ctx.session.coffeeWeight),
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "m-unit" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.device.isConnected))
                            return;
                        if (!!(__VLS_ctx.mode === 'standard'))
                            return;
                        if (!(__VLS_ctx.session.coffeeWeight))
                            return;
                        __VLS_ctx.session.clearCoffee();
                    } },
                ...{ class: "btn tiny" },
                type: "button",
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.device.isConnected))
                            return;
                        if (!!(__VLS_ctx.mode === 'standard'))
                            return;
                        if (!!(__VLS_ctx.session.coffeeWeight))
                            return;
                        __VLS_ctx.session.setCoffee();
                    } },
                ...{ class: "btn" },
                type: "button",
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "controls" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.device.isConnected))
                        return;
                    if (!!(__VLS_ctx.mode === 'standard'))
                        return;
                    __VLS_ctx.device.tare();
                } },
            ...{ class: "btn" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.device.isConnected))
                        return;
                    if (!!(__VLS_ctx.mode === 'standard'))
                        return;
                    __VLS_ctx.session.armOrStart();
                } },
            ...{ class: "btn primary" },
        });
        (__VLS_ctx.mainBtnText);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.device.isConnected))
                        return;
                    if (!!(__VLS_ctx.mode === 'standard'))
                        return;
                    __VLS_ctx.session.pauseResume();
                } },
            ...{ class: "btn" },
            disabled: (!__VLS_ctx.session.running && !__VLS_ctx.session.paused),
        });
        (__VLS_ctx.session.paused ? '继续' : '暂停');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.device.isConnected))
                        return;
                    if (!!(__VLS_ctx.mode === 'standard'))
                        return;
                    __VLS_ctx.session.stop();
                } },
            ...{ class: "btn" },
            disabled: (!__VLS_ctx.session.running && !__VLS_ctx.session.paused),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.device.isConnected))
                        return;
                    if (!!(__VLS_ctx.mode === 'standard'))
                        return;
                    __VLS_ctx.session.reset();
                } },
            ...{ class: "btn ghost wide" },
            disabled: (__VLS_ctx.session.session.state === 'idle'),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "auto-start-row" },
        });
        /** @type {[typeof ToggleSwitch, ]} */ ;
        // @ts-ignore
        const __VLS_0 = __VLS_asFunctionalComponent(ToggleSwitch, new ToggleSwitch({
            modelValue: (__VLS_ctx.session.autoStart),
            label: "自动计时（注水自动开始）",
        }));
        const __VLS_1 = __VLS_0({
            modelValue: (__VLS_ctx.session.autoStart),
            label: "自动计时（注水自动开始）",
        }, ...__VLS_functionalComponentArgsRest(__VLS_0));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "hint-inline" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "plan-pick" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "m-label" },
            for: "plan-select",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            id: "plan-select",
            value: (__VLS_ctx.session.selectedPlanId),
            ...{ class: "plan-select" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: (null),
        });
        for (const [p] of __VLS_getVForSourceType((__VLS_ctx.plans.list))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
                key: (p.id),
                value: (p.id),
            });
            (p.name);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.device.isConnected))
                        return;
                    if (!!(__VLS_ctx.mode === 'standard'))
                        return;
                    __VLS_ctx.session.startWithPlan(__VLS_ctx.session.selectedPlanId);
                } },
            ...{ class: "btn primary" },
            disabled: (!__VLS_ctx.session.selectedPlanId),
        });
    }
    if (__VLS_ctx.device.isSimulator) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "sim-panel" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "sim-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
            ...{ class: "sim-row" },
            for: "sim-rate",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ onInput: (__VLS_ctx.applySimRate) },
            id: "sim-rate",
            type: "range",
            min: "-10",
            max: "10",
            step: "0.5",
        });
        (__VLS_ctx.simPourRate);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "num" },
        });
        (__VLS_ctx.simPourRate.toFixed(1));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.device.isConnected))
                        return;
                    if (!(__VLS_ctx.device.isSimulator))
                        return;
                    __VLS_ctx.simPlayFullBrew();
                } },
            ...{ class: "btn tiny" },
        });
    }
    if (__VLS_ctx.mode === 'pour') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
            ...{ class: "pane chart-pane" },
            'aria-label': "冲煮曲线",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "chart-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "chart-title" },
        });
        if (__VLS_ctx.chartTargetCurve) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "chart-legend" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "dash-sample" },
                'aria-hidden': "true",
            });
        }
        /** @type {[typeof BrewChart, ]} */ ;
        // @ts-ignore
        const __VLS_3 = __VLS_asFunctionalComponent(BrewChart, new BrewChart({
            samples: (__VLS_ctx.session.session.samples),
            targetCurve: (__VLS_ctx.chartTargetCurve),
            steps: (__VLS_ctx.chartPlan?.steps ?? null),
            live: (__VLS_ctx.session.running),
            currentStep: (__VLS_ctx.session.planProgress?.current ?? null),
            height: (300),
        }));
        const __VLS_4 = __VLS_3({
            samples: (__VLS_ctx.session.session.samples),
            targetCurve: (__VLS_ctx.chartTargetCurve),
            steps: (__VLS_ctx.chartPlan?.steps ?? null),
            live: (__VLS_ctx.session.running),
            currentStep: (__VLS_ctx.session.planProgress?.current ?? null),
            height: (300),
        }, ...__VLS_functionalComponentArgsRest(__VLS_3));
        if (__VLS_ctx.session.planProgress) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "plan-progress" },
                ...{ class: ({ done: __VLS_ctx.session.planProgress.done }) },
            });
            if (!__VLS_ctx.session.planProgress.done) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "pp-row" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "pp-label" },
                });
                (__VLS_ctx.session.planProgress.current ? '当前步骤' : '间隙');
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "pp-value" },
                });
                (__VLS_ctx.session.planProgress.current ? __VLS_ctx.fmtStep(__VLS_ctx.session.planProgress.current) : '等待下一阶段');
                if (__VLS_ctx.session.planProgress.next) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "pp-row" },
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                        ...{ class: "pp-label" },
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                        ...{ class: "pp-value mute" },
                    });
                    (__VLS_ctx.fmtStep(__VLS_ctx.session.planProgress.next));
                }
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "pp-row" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "pp-label" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "pp-value num" },
                });
                (__VLS_ctx.session.planProgress.targetG.toFixed(0));
                (__VLS_ctx.session.waterG.toFixed(1));
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: (__VLS_ctx.session.planProgress.deltaG >= 0 ? 'delta-pos' : 'delta-neg') },
                });
                (__VLS_ctx.session.planProgress.deltaG >= 0 ? '+' : '');
                (__VLS_ctx.session.planProgress.deltaG.toFixed(1));
            }
            else {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "pp-row" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "pp-label" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                    ...{ class: "pp-value ok-text" },
                });
            }
        }
        if (!__VLS_ctx.chartPlan) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "chart-empty" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
    }
}
/** @type {__VLS_StyleScopedClasses['connect-card']} */ ;
/** @type {__VLS_StyleScopedClasses['connect-inner']} */ ;
/** @type {__VLS_StyleScopedClasses['connect-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['hint']} */ ;
/** @type {__VLS_StyleScopedClasses['weigh']} */ ;
/** @type {__VLS_StyleScopedClasses['pane']} */ ;
/** @type {__VLS_StyleScopedClasses['scale-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['weight-block']} */ ;
/** @type {__VLS_StyleScopedClasses['weight-label']} */ ;
/** @type {__VLS_StyleScopedClasses['weight-value']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['weight-unit']} */ ;
/** @type {__VLS_StyleScopedClasses['overload-tip']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['big']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-block']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-label']} */ ;
/** @type {__VLS_StyleScopedClasses['timer-value']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['metrics']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['m-label']} */ ;
/** @type {__VLS_StyleScopedClasses['m-value']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['m-unit']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['m-label']} */ ;
/** @type {__VLS_StyleScopedClasses['m-value']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['m-unit']} */ ;
/** @type {__VLS_StyleScopedClasses['metric']} */ ;
/** @type {__VLS_StyleScopedClasses['m-label']} */ ;
/** @type {__VLS_StyleScopedClasses['m-value']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['coffee-block']} */ ;
/** @type {__VLS_StyleScopedClasses['coffee-label']} */ ;
/** @type {__VLS_StyleScopedClasses['coffee-row']} */ ;
/** @type {__VLS_StyleScopedClasses['coffee-input']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['m-unit']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['controls']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['wide']} */ ;
/** @type {__VLS_StyleScopedClasses['auto-start-row']} */ ;
/** @type {__VLS_StyleScopedClasses['hint-inline']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-pick']} */ ;
/** @type {__VLS_StyleScopedClasses['m-label']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-select']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['sim-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['sim-title']} */ ;
/** @type {__VLS_StyleScopedClasses['sim-row']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
/** @type {__VLS_StyleScopedClasses['pane']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-pane']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-head']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-title']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-legend']} */ ;
/** @type {__VLS_StyleScopedClasses['dash-sample']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-progress']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-row']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-label']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-value']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-row']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-label']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-value']} */ ;
/** @type {__VLS_StyleScopedClasses['mute']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-row']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-label']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-value']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-row']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-label']} */ ;
/** @type {__VLS_StyleScopedClasses['pp-value']} */ ;
/** @type {__VLS_StyleScopedClasses['ok-text']} */ ;
/** @type {__VLS_StyleScopedClasses['chart-empty']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            BrewChart: BrewChart,
            ToggleSwitch: ToggleSwitch,
            device: device,
            session: session,
            plans: plans,
            mode: mode,
            setMode: setMode,
            connecting: connecting,
            connect: connect,
            connectSim: connectSim,
            simPourRate: simPourRate,
            applySimRate: applySimRate,
            simPlayFullBrew: simPlayFullBrew,
            weightText: weightText,
            weightClass: weightClass,
            mainBtnText: mainBtnText,
            ratioText: ratioText,
            chartPlan: chartPlan,
            chartTargetCurve: chartTargetCurve,
            fmtStep: fmtStep,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
