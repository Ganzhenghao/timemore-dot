import { ref, watch } from 'vue';
const props = withDefaults(defineProps(), { confirmText: '确认', cancelText: '取消', danger: false });
const emit = defineEmits();
const el = ref(null);
watch(() => props.open, (v) => {
    if (!el.value)
        return;
    if (v && !el.value.open)
        el.value.showModal();
    else if (!v && el.value.open)
        el.value.close();
});
function onConfirm() {
    emit('confirm');
    emit('update:open', false);
}
function onClose() {
    emit('cancel');
    emit('update:open', false);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({ confirmText: '确认', cancelText: '取消', danger: false });
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.dialog, __VLS_intrinsicElements.dialog)({
    ...{ onClose: (__VLS_ctx.onClose) },
    ref: "el",
    'aria-labelledby': "confirm-title",
});
/** @type {typeof __VLS_ctx.el} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    id: "confirm-title",
});
(__VLS_ctx.title);
if (__VLS_ctx.message) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "msg" },
    });
    (__VLS_ctx.message);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
    method: "dialog",
    ...{ class: "actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    value: ('cancel'),
    ...{ class: "btn ghost" },
    autofocus: true,
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.onConfirm) },
    type: "button",
    ...{ class: "btn" },
    ...{ class: (__VLS_ctx.danger ? 'danger' : 'primary') },
});
(__VLS_ctx.confirmText);
/** @type {__VLS_StyleScopedClasses['msg']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            el: el,
            onConfirm: onConfirm,
            onClose: onClose,
        };
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
