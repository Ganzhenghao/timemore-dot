import { onMounted, ref, watch } from 'vue';
import { useDeviceStore } from './stores/device';
import { usePlansStore } from './stores/plans';
import WeighView from './views/WeighView.vue';
import PlansView from './views/PlansView.vue';
import HistoryView from './views/HistoryView.vue';
import SettingsView from './views/SettingsView.vue';
import AppToast from './components/AppToast.vue';
const device = useDeviceStore();
const plans = usePlansStore();
const tab = ref(localStorage.getItem('tab') || 'weigh');
watch(tab, (v) => localStorage.setItem('tab', v));
const tabs = [
    { key: 'weigh', label: '称量' },
    { key: 'plans', label: '冲煮计划' },
    { key: 'history', label: '历史记录' },
    { key: 'settings', label: '设置' },
];
const statusText = {
    disconnected: '未连接',
    connecting: '连接中…',
    connected: device.isSimulator ? '仿真秤' : '已连接',
};
onMounted(() => {
    plans.load();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['conn']} */ ;
/** @type {__VLS_StyleScopedClasses['conn-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['conn']} */ ;
/** @type {__VLS_StyleScopedClasses['conn-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "topbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    'aria-hidden': "true",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.path)({
    d: "M12 3v3M7 21h10M5 8h14l-2 9H7L5 8z",
    stroke: "var(--ac)",
    'stroke-width': "1.6",
    'stroke-linecap': "round",
    'stroke-linejoin': "round",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "brand-name" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "brand-sub" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "conn" },
    'data-state': (__VLS_ctx.device.connectionState),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "conn-dot" },
    'aria-hidden': "true",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "conn-text" },
});
(__VLS_ctx.statusText[__VLS_ctx.device.connectionState]);
if (__VLS_ctx.device.isConnected) {
    if (__VLS_ctx.device.signalLost) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "conn-warn" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "battery" },
            title: (`电量 ${__VLS_ctx.device.batteryPercent}%`),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.svg, __VLS_intrinsicElements.svg)({
            width: "18",
            height: "12",
            viewBox: "0 0 20 12",
            'aria-hidden': "true",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.rect)({
            x: "0.5",
            y: "0.5",
            width: "16",
            height: "11",
            rx: "2",
            stroke: "var(--tx-mute)",
            fill: "none",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.rect)({
            x: "17",
            y: "3.5",
            width: "2.5",
            height: "5",
            rx: "1",
            fill: "var(--tx-mute)",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.rect)({
            x: "2.5",
            y: "2.5",
            width: (Math.max(1, (__VLS_ctx.device.batteryPercent / 100) * 12)),
            height: "7",
            rx: "1",
            fill: (__VLS_ctx.device.batteryPercent > 20 ? 'var(--ok)' : 'var(--err)'),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "num" },
        });
        (__VLS_ctx.device.batteryPercent);
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({
    ...{ class: "tabs" },
    'aria-label': "视图导航",
});
for (const [t] of __VLS_getVForSourceType((__VLS_ctx.tabs))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.tab = t.key;
            } },
        key: (t.key),
        type: "button",
        ...{ class: "tab" },
        ...{ class: ({ active: __VLS_ctx.tab === t.key }) },
        'aria-current': (__VLS_ctx.tab === t.key ? 'page' : undefined),
    });
    (t.label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "content" },
});
const __VLS_0 = {}.KeepAlive;
/** @type {[typeof __VLS_components.KeepAlive, typeof __VLS_components.KeepAlive, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
if (__VLS_ctx.tab === 'weigh') {
    /** @type {[typeof WeighView, ]} */ ;
    // @ts-ignore
    const __VLS_4 = __VLS_asFunctionalComponent(WeighView, new WeighView({}));
    const __VLS_5 = __VLS_4({}, ...__VLS_functionalComponentArgsRest(__VLS_4));
}
if (__VLS_ctx.tab === 'plans') {
    /** @type {[typeof PlansView, ]} */ ;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent(PlansView, new PlansView({}));
    const __VLS_8 = __VLS_7({}, ...__VLS_functionalComponentArgsRest(__VLS_7));
}
if (__VLS_ctx.tab === 'history') {
    /** @type {[typeof HistoryView, ]} */ ;
    // @ts-ignore
    const __VLS_10 = __VLS_asFunctionalComponent(HistoryView, new HistoryView({}));
    const __VLS_11 = __VLS_10({}, ...__VLS_functionalComponentArgsRest(__VLS_10));
}
if (__VLS_ctx.tab === 'settings') {
    /** @type {[typeof SettingsView, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(SettingsView, new SettingsView({}));
    const __VLS_14 = __VLS_13({}, ...__VLS_functionalComponentArgsRest(__VLS_13));
}
var __VLS_3;
/** @type {[typeof AppToast, ]} */ ;
// @ts-ignore
const __VLS_16 = __VLS_asFunctionalComponent(AppToast, new AppToast({}));
const __VLS_17 = __VLS_16({}, ...__VLS_functionalComponentArgsRest(__VLS_16));
/** @type {__VLS_StyleScopedClasses['app']} */ ;
/** @type {__VLS_StyleScopedClasses['topbar']} */ ;
/** @type {__VLS_StyleScopedClasses['brand']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-name']} */ ;
/** @type {__VLS_StyleScopedClasses['brand-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['conn']} */ ;
/** @type {__VLS_StyleScopedClasses['conn-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['conn-text']} */ ;
/** @type {__VLS_StyleScopedClasses['conn-warn']} */ ;
/** @type {__VLS_StyleScopedClasses['battery']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['tab']} */ ;
/** @type {__VLS_StyleScopedClasses['content']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            WeighView: WeighView,
            PlansView: PlansView,
            HistoryView: HistoryView,
            SettingsView: SettingsView,
            AppToast: AppToast,
            device: device,
            tab: tab,
            tabs: tabs,
            statusText: statusText,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
