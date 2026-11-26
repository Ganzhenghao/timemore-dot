import { computed, reactive, ref, watch } from 'vue';
import { usePlansStore } from '../stores/plans';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import BrewChart from '../components/BrewChart.vue';
import { defaultPlan, formatClock, planDurationS, targetCurve, validateSteps, } from '../core/planModel';
const plans = usePlansStore();
const editorOpen = ref(false);
const editorEl = ref(null);
const editorError = ref('');
const deletingId = ref(null);
const deleteConfirm = ref(false);
// 原生 dialog：按 modern-web-guidance 用 showModal() 而非 open 属性
watch(editorOpen, (v) => {
    if (v)
        editorEl.value?.showModal();
    else if (editorEl.value?.open)
        editorEl.value.close();
});
const draft = reactive({ name: '', coffeeWeight: null, ratio: null, steps: [] });
const editingId = ref(null);
function openCreate() {
    editingId.value = null;
    Object.assign(draft, { id: undefined, name: '', coffeeWeight: null, ratio: null, steps: [] });
    editorError.value = '';
    editorOpen.value = true;
}
function openEdit(plan) {
    editingId.value = plan.id ?? null;
    Object.assign(draft, JSON.parse(JSON.stringify({ ...plan })));
    editorError.value = '';
    editorOpen.value = true;
}
function openCopy(plan) {
    editingId.value = null;
    Object.assign(draft, JSON.parse(JSON.stringify({ ...plan, id: undefined, name: `${plan.name} 副本` })));
    editorError.value = '';
    editorOpen.value = true;
}
function openTemplate() {
    editingId.value = null;
    Object.assign(draft, JSON.parse(JSON.stringify(defaultPlan())));
    editorError.value = '';
    editorOpen.value = true;
}
function addStep() {
    const last = draft.steps[draft.steps.length - 1];
    const startS = last ? last.endS : 0;
    draft.steps.push({ type: 'pour', startS, endS: startS + 10, targetG: undefined, label: '' });
}
function removeStep(i) {
    draft.steps.splice(i, 1);
}
async function submit() {
    editorError.value = validateSteps(draft.steps) ?? '';
    if (editorError.value)
        return;
    const payload = {
        ...draft,
        id: editingId.value ?? undefined,
        coffeeWeight: draft.coffeeWeight || null,
        ratio: draft.ratio || null,
    };
    const ok = await plans.save(payload);
    if (ok)
        editorOpen.value = false;
}
watch(() => draft.steps, () => {
    // 修改即清除提交错误，避免边改边报
    if (editorError.value)
        editorError.value = validateSteps(draft.steps) ?? '';
}, { deep: true });
const draftCurve = computed(() => (validateSteps(draft.steps) ? [] : targetCurve(draft.steps)));
const previewSamples = computed(() => {
    // 用目标曲线点生成静态样本以便 BrewChart 渲染实际曲线区
    return draftCurve.value.map((p) => ({ t: p.tS * 1000, w: p.wG, f: 0 }));
});
async function confirmDelete() {
    if (deletingId.value == null)
        return;
    await plans.remove(deletingId.value);
    deletingId.value = null;
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-head']} */ ;
/** @type {__VLS_StyleScopedClasses['step-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-field']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-field']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-field']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-table']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-table']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-table']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-table']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "plans" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "page-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "head-actions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.openTemplate();
        } },
    ...{ class: "btn" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.openCreate();
        } },
    ...{ class: "btn primary" },
});
if (!__VLS_ctx.plans.loaded || __VLS_ctx.plans.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty" },
    });
}
else if (__VLS_ctx.plans.list.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.plans.loaded || __VLS_ctx.plans.loading))
                    return;
                if (!(__VLS_ctx.plans.list.length === 0))
                    return;
                __VLS_ctx.openTemplate();
            } },
        ...{ class: "btn primary" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.ul, __VLS_intrinsicElements.ul)({
        ...{ class: "plan-list" },
    });
    for (const [p] of __VLS_getVForSourceType((__VLS_ctx.plans.list))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.li, __VLS_intrinsicElements.li)({
            key: (p.id),
            ...{ class: "plan-card" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card-main" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card-name" },
        });
        (p.name);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card-meta num" },
        });
        if (p.coffeeWeight) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (p.coffeeWeight);
        }
        if (p.ratio) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (p.ratio);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (p.steps.length);
        (__VLS_ctx.formatClock(__VLS_ctx.planDurationS(p.steps)));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card-steps" },
        });
        for (const [s, i] of __VLS_getVForSourceType((p.steps))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                key: (i),
                ...{ class: "step-chip" },
                ...{ class: (s.type) },
                title: (`${s.label ?? ''} ${__VLS_ctx.formatClock(s.startS)}–${__VLS_ctx.formatClock(s.endS)}${s.targetG ? ' → ' + s.targetG + 'g' : ''}`),
            });
            (s.label ?? (s.type === 'pour' ? `→${s.targetG}g` : '停顿'));
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "card-actions" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.plans.loaded || __VLS_ctx.plans.loading))
                        return;
                    if (!!(__VLS_ctx.plans.list.length === 0))
                        return;
                    __VLS_ctx.openEdit(p);
                } },
            ...{ class: "btn tiny" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.plans.loaded || __VLS_ctx.plans.loading))
                        return;
                    if (!!(__VLS_ctx.plans.list.length === 0))
                        return;
                    __VLS_ctx.openCopy(p);
                } },
            ...{ class: "btn tiny" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(!__VLS_ctx.plans.loaded || __VLS_ctx.plans.loading))
                        return;
                    if (!!(__VLS_ctx.plans.list.length === 0))
                        return;
                    __VLS_ctx.deletingId = p.id;
                    __VLS_ctx.deleteConfirm = true;
                } },
            ...{ class: "btn tiny danger" },
        });
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.dialog, __VLS_intrinsicElements.dialog)({
    ...{ onClose: (...[$event]) => {
            __VLS_ctx.editorOpen = false;
        } },
    ref: "editorEl",
    ...{ class: "editor" },
});
/** @type {typeof __VLS_ctx.editorEl} */ ;
if (__VLS_ctx.editorOpen) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "editor-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.editingId ? '编辑计划' : '新建计划');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.submit) },
        ...{ class: "form" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "plan-name",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "plan-name",
        name: "plan-name",
        required: true,
        maxlength: "64",
        'aria-invalid': (!!__VLS_ctx.editorError),
    });
    (__VLS_ctx.draft.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "plan-coffee",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "plan-coffee",
        value: (__VLS_ctx.draft.coffeeWeight),
        name: "plan-coffee",
        type: "text",
        inputmode: "decimal",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "plan-ratio",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "plan-ratio",
        value: (__VLS_ctx.draft.ratio),
        name: "plan-ratio",
        type: "text",
        inputmode: "decimal",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.fieldset, __VLS_intrinsicElements.fieldset)({
        ...{ class: "steps-field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.legend, __VLS_intrinsicElements.legend)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
        ...{ class: "steps-table" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
    for (const [s, i] of __VLS_getVForSourceType((__VLS_ctx.draft.steps))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            key: (i),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
            value: (s.type),
            'aria-label': (`步骤 ${i + 1} 类型`),
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "pour",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            value: "pause",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            'aria-label': (`步骤 ${i + 1} 标签`),
            maxlength: "32",
            placeholder: "如 闷蒸",
        });
        (s.label);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            value: (s.startS),
            'aria-label': (`步骤 ${i + 1} 开始秒`),
            type: "text",
            inputmode: "numeric",
            required: true,
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            value: (s.endS),
            'aria-label': (`步骤 ${i + 1} 结束秒`),
            type: "text",
            inputmode: "numeric",
            required: true,
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        if (s.type === 'pour') {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
                value: (s.targetG),
                'aria-label': (`步骤 ${i + 1} 目标克重`),
                type: "text",
                inputmode: "decimal",
                required: true,
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "na" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.editorOpen))
                        return;
                    __VLS_ctx.removeStep(i);
                } },
            ...{ class: "btn tiny danger" },
            type: "button",
            'aria-label': (`删除步骤 ${i + 1}`),
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.editorOpen))
                    return;
                __VLS_ctx.addStep();
            } },
        ...{ class: "btn tiny" },
        type: "button",
    });
    if (__VLS_ctx.editorError) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "error-msg" },
            role: "alert",
        });
        (__VLS_ctx.editorError);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "preview-title" },
    });
    /** @type {[typeof BrewChart, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(BrewChart, new BrewChart({
        samples: (__VLS_ctx.previewSamples),
        targetCurve: (__VLS_ctx.draftCurve),
        steps: (__VLS_ctx.draft.steps),
        height: (220),
    }));
    const __VLS_1 = __VLS_0({
        samples: (__VLS_ctx.previewSamples),
        targetCurve: (__VLS_ctx.draftCurve),
        steps: (__VLS_ctx.draft.steps),
        height: (220),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.editorOpen))
                    return;
                __VLS_ctx.editorOpen = false;
            } },
        ...{ class: "btn ghost" },
        type: "button",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ class: "btn primary" },
        type: "submit",
    });
}
/** @type {[typeof ConfirmDialog, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(ConfirmDialog, new ConfirmDialog({
    ...{ 'onConfirm': {} },
    open: (__VLS_ctx.deleteConfirm),
    title: "删除冲煮计划？",
    message: (`将删除「${__VLS_ctx.plans.list.find((p) => p.id === __VLS_ctx.deletingId)?.name ?? ''}」，历史记录不受影响。`),
    confirmText: "删除",
    danger: true,
}));
const __VLS_4 = __VLS_3({
    ...{ 'onConfirm': {} },
    open: (__VLS_ctx.deleteConfirm),
    title: "删除冲煮计划？",
    message: (`将删除「${__VLS_ctx.plans.list.find((p) => p.id === __VLS_ctx.deletingId)?.name ?? ''}」，历史记录不受影响。`),
    confirmText: "删除",
    danger: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_3));
let __VLS_6;
let __VLS_7;
let __VLS_8;
const __VLS_9 = {
    onConfirm: (__VLS_ctx.confirmDelete)
};
var __VLS_5;
/** @type {__VLS_StyleScopedClasses['plans']} */ ;
/** @type {__VLS_StyleScopedClasses['page-head']} */ ;
/** @type {__VLS_StyleScopedClasses['head-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-list']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-main']} */ ;
/** @type {__VLS_StyleScopedClasses['card-name']} */ ;
/** @type {__VLS_StyleScopedClasses['card-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['card-steps']} */ ;
/** @type {__VLS_StyleScopedClasses['step-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['card-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['editor']} */ ;
/** @type {__VLS_StyleScopedClasses['editor-body']} */ ;
/** @type {__VLS_StyleScopedClasses['form']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field-row']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-field']} */ ;
/** @type {__VLS_StyleScopedClasses['steps-table']} */ ;
/** @type {__VLS_StyleScopedClasses['na']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
/** @type {__VLS_StyleScopedClasses['error-msg']} */ ;
/** @type {__VLS_StyleScopedClasses['preview']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-title']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['ghost']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ConfirmDialog: ConfirmDialog,
            BrewChart: BrewChart,
            formatClock: formatClock,
            planDurationS: planDurationS,
            plans: plans,
            editorOpen: editorOpen,
            editorEl: editorEl,
            editorError: editorError,
            deletingId: deletingId,
            deleteConfirm: deleteConfirm,
            draft: draft,
            editingId: editingId,
            openCreate: openCreate,
            openEdit: openEdit,
            openCopy: openCopy,
            openTemplate: openTemplate,
            addStep: addStep,
            removeStep: removeStep,
            submit: submit,
            draftCurve: draftCurve,
            previewSamples: previewSamples,
            confirmDelete: confirmDelete,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
