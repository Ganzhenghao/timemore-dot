const __VLS_props = defineProps();
const emit = defineEmits();
function onInput(e) {
    emit('update:modelValue', e.target.checked);
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['switch-row']} */ ;
/** @type {__VLS_StyleScopedClasses['switch-input']} */ ;
/** @type {__VLS_StyleScopedClasses['switch-input']} */ ;
/** @type {__VLS_StyleScopedClasses['switch-input']} */ ;
/** @type {__VLS_StyleScopedClasses['switch-input']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
    ...{ class: "switch-row" },
    ...{ class: ({ disabled: __VLS_ctx.disabled }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "switch-label" },
});
(__VLS_ctx.label);
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ onChange: (__VLS_ctx.onInput) },
    id: (`sw-${__VLS_ctx.label}`),
    type: "checkbox",
    role: "switch",
    ...{ class: "switch-input" },
    checked: (__VLS_ctx.modelValue),
    disabled: (__VLS_ctx.disabled),
});
/** @type {__VLS_StyleScopedClasses['switch-row']} */ ;
/** @type {__VLS_StyleScopedClasses['switch-label']} */ ;
/** @type {__VLS_StyleScopedClasses['switch-input']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            onInput: onInput,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
