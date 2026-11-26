import { useToastStore } from '../stores/toast';
const toast = useToastStore();
function mount(el) {
    if (el instanceof HTMLElement && typeof el.showPopover === 'function') {
        if (!el.matches(':popover-open')) {
            try {
                el.showPopover();
            }
            catch {
                /* 已显示或不可用忽略 */
            }
        }
    }
}
const kindColor = {
    ok: 'var(--ok)',
    err: 'var(--err)',
    warn: 'var(--warn)',
    info: 'var(--ac)',
};
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['toast']} */ ;
/** @type {__VLS_StyleScopedClasses['toast']} */ ;
/** @type {__VLS_StyleScopedClasses['toast']} */ ;
/** @type {__VLS_StyleScopedClasses['toast']} */ ;
/** @type {__VLS_StyleScopedClasses['close']} */ ;
/** @type {__VLS_StyleScopedClasses['toast']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    role: "region",
    'aria-label': "通知",
    ...{ class: "toast-region" },
});
for (const [t, i] of __VLS_getVForSourceType((__VLS_ctx.toast.items))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (t.id),
        ref: (__VLS_ctx.mount),
        popover: "manual",
        ...{ class: "toast" },
        ...{ style: ({ '--kind': __VLS_ctx.kindColor[t.kind] ?? 'var(--ac)', bottom: `${20 + i * 56}px` }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "dot" },
        'aria-hidden': "true",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text" },
    });
    (t.text);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.toast.dismiss(t.id);
            } },
        ...{ class: "close" },
        type: "button",
        'aria-label': (`关闭通知：${t.text}`),
    });
}
/** @type {__VLS_StyleScopedClasses['toast-region']} */ ;
/** @type {__VLS_StyleScopedClasses['toast']} */ ;
/** @type {__VLS_StyleScopedClasses['dot']} */ ;
/** @type {__VLS_StyleScopedClasses['text']} */ ;
/** @type {__VLS_StyleScopedClasses['close']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            toast: toast,
            mount: mount,
            kindColor: kindColor,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
