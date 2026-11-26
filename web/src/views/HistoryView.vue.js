import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useToastStore } from '../stores/toast';
import { usePlansStore } from '../stores/plans';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import BrewChart from '../components/BrewChart.vue';
import { formatClock, targetCurve } from '../core/planModel';
const toast = useToastStore();
const plans = usePlansStore();
const rows = ref([]);
const total = ref(0);
const page = ref(1);
const size = 10;
const loading = ref(false);
const detail = ref(null);
const detailRow = ref(null);
const ratingDraft = ref(0);
const notesDraft = ref('');
const deleteConfirm = ref(false);
const deletingId = ref(null);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size)));
async function load() {
    loading.value = true;
    try {
        const r = await api.recordPageQuery({ page: page.value, size });
        rows.value = r.list;
        total.value = r.total;
    }
    catch (e) {
        toast.push(`加载历史失败: ${e.message}`, 'err');
    }
    finally {
        loading.value = false;
    }
}
onMounted(load);
async function openDetail(row) {
    try {
        const d = await api.recordGetById(row.id);
        const samples = d.samples
            ? d.samples.t.map((t, i) => ({ t, w: d.samples.w[i] / 10, f: d.samples.f[i] / 10 }))
            : [];
        const plan = d.planId != null ? plans.list.find((p) => p.id === d.planId) : null;
        detail.value = {
            id: d.id,
            samples,
            steps: plan ? targetCurve(plan.steps) : null,
            planName: plan?.name ?? null,
        };
        detailRow.value = d;
        ratingDraft.value = d.rating ?? 0;
        notesDraft.value = d.notes ?? '';
    }
    catch (e) {
        toast.push(`加载详情失败: ${e.message}`, 'err');
    }
}
async function savePatch() {
    if (!detailRow.value)
        return;
    try {
        await api.recordUpdate(detailRow.value.id, { rating: ratingDraft.value || null, notes: notesDraft.value });
        toast.push('已保存', 'ok');
        await load();
    }
    catch (e) {
        toast.push(`保存失败: ${e.message}`, 'err');
    }
}
async function confirmDelete() {
    if (deletingId.value == null)
        return;
    await api.recordDelete(deletingId.value);
    if (detailRow.value?.id === deletingId.value) {
        detail.value = null;
        detailRow.value = null;
    }
    deletingId.value = null;
    toast.push('记录已删除', 'info');
    await load();
}
function fmtDate(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtDuration(ms) {
    return ms != null ? formatClock(ms / 1000) : '—';
}
const detailStepsForChart = computed(() => {
    if (!detailRow.value?.planId)
        return null;
    const plan = plans.list.find((p) => p.id === detailRow.value?.planId);
    return plan?.steps ?? null;
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['page-head']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-head']} */ ;
/** @type {__VLS_StyleScopedClasses['d-item']} */ ;
/** @type {__VLS_StyleScopedClasses['d-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-notes']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-notes']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-notes']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-notes']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "history" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "page-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "total num" },
});
(__VLS_ctx.total);
if (__VLS_ctx.rows.length === 0 && !__VLS_ctx.loading) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.table, __VLS_intrinsicElements.table)({
        ...{ class: "table" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.thead, __VLS_intrinsicElements.thead)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.th, __VLS_intrinsicElements.th)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.tbody, __VLS_intrinsicElements.tbody)({});
    for (const [r] of __VLS_getVForSourceType((__VLS_ctx.rows))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.tr, __VLS_intrinsicElements.tr)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.rows.length === 0 && !__VLS_ctx.loading))
                        return;
                    __VLS_ctx.openDetail(r);
                } },
            key: (r.id),
            ...{ class: ({ active: __VLS_ctx.detailRow?.id === r.id }) },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "num" },
        });
        (__VLS_ctx.fmtDate(r.startedAt));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "num" },
        });
        (__VLS_ctx.fmtDuration(r.durationMs));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "num" },
        });
        (r.coffeeWeight ?? '—');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "num" },
        });
        (r.waterTotal != null ? r.waterTotal.toFixed(1) : '—');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "num" },
        });
        (r.peakFlow != null ? r.peakFlow.toFixed(1) + ' g/s' : '—');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({});
        ((__VLS_ctx.plans.list.find((p) => p.id === r.planId)?.name) ?? '—');
        __VLS_asFunctionalElement(__VLS_intrinsicElements.td, __VLS_intrinsicElements.td)({
            ...{ class: "num" },
        });
        (r.rating ? '★'.repeat(r.rating) : '—');
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "pager" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.page--;
            __VLS_ctx.load();
        } },
    ...{ class: "btn tiny" },
    disabled: (__VLS_ctx.page <= 1),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "num" },
});
(__VLS_ctx.page);
(__VLS_ctx.totalPages);
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.page++;
            __VLS_ctx.load();
        } },
    ...{ class: "btn tiny" },
    disabled: (__VLS_ctx.page >= __VLS_ctx.totalPages),
});
if (__VLS_ctx.detail && __VLS_ctx.detailRow) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "detail" },
        'aria-label': "记录详情",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({});
    (__VLS_ctx.fmtDate(__VLS_ctx.detailRow.startedAt));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.detail && __VLS_ctx.detailRow))
                    return;
                __VLS_ctx.deletingId = __VLS_ctx.detailRow.id;
                __VLS_ctx.deleteConfirm = true;
            } },
        ...{ class: "btn tiny danger" },
    });
    /** @type {[typeof BrewChart, ]} */ ;
    // @ts-ignore
    const __VLS_0 = __VLS_asFunctionalComponent(BrewChart, new BrewChart({
        samples: (__VLS_ctx.detail.samples),
        targetCurve: (__VLS_ctx.detail.steps),
        steps: (__VLS_ctx.detailStepsForChart),
        height: (260),
    }));
    const __VLS_1 = __VLS_0({
        samples: (__VLS_ctx.detail.samples),
        targetCurve: (__VLS_ctx.detail.steps),
        steps: (__VLS_ctx.detailStepsForChart),
        height: (260),
    }, ...__VLS_functionalComponentArgsRest(__VLS_0));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({
        ...{ class: "num" },
    });
    (__VLS_ctx.fmtDuration(__VLS_ctx.detailRow.durationMs));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({
        ...{ class: "num" },
    });
    (__VLS_ctx.detailRow.coffeeWeight ?? '—');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({
        ...{ class: "num" },
    });
    (__VLS_ctx.detailRow.waterTotal ?? '—');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({
        ...{ class: "num" },
    });
    (__VLS_ctx.detailRow.peakFlow ?? '—');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({
        ...{ class: "num" },
    });
    (__VLS_ctx.detailRow.avgFlow ?? '—');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "d-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.b, __VLS_intrinsicElements.b)({});
    (__VLS_ctx.detail.planName ?? '—');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "detail-notes" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "detail-rating",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
        id: "detail-rating",
        value: (__VLS_ctx.ratingDraft),
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        value: (0),
    });
    for (const [n] of __VLS_getVForSourceType((5))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
            key: (n),
            value: (n),
        });
        ('★'.repeat(n));
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "detail-notes",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
        id: "detail-notes",
        value: (__VLS_ctx.notesDraft),
        rows: "2",
        maxlength: "2000",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.detail && __VLS_ctx.detailRow))
                    return;
                __VLS_ctx.savePatch();
            } },
        ...{ class: "btn primary tiny" },
    });
}
/** @type {[typeof ConfirmDialog, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(ConfirmDialog, new ConfirmDialog({
    ...{ 'onConfirm': {} },
    open: (__VLS_ctx.deleteConfirm),
    title: "删除冲煮记录？",
    message: "删除后不可恢复。",
    confirmText: "删除",
    danger: true,
}));
const __VLS_4 = __VLS_3({
    ...{ 'onConfirm': {} },
    open: (__VLS_ctx.deleteConfirm),
    title: "删除冲煮记录？",
    message: "删除后不可恢复。",
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
/** @type {__VLS_StyleScopedClasses['history']} */ ;
/** @type {__VLS_StyleScopedClasses['page-head']} */ ;
/** @type {__VLS_StyleScopedClasses['total']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['empty']} */ ;
/** @type {__VLS_StyleScopedClasses['table']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['pager']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
/** @type {__VLS_StyleScopedClasses['detail']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-head']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['d-item']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['d-item']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['d-item']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['d-item']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['d-item']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['d-item']} */ ;
/** @type {__VLS_StyleScopedClasses['detail-notes']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['tiny']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ConfirmDialog: ConfirmDialog,
            BrewChart: BrewChart,
            plans: plans,
            rows: rows,
            total: total,
            page: page,
            loading: loading,
            detail: detail,
            detailRow: detailRow,
            ratingDraft: ratingDraft,
            notesDraft: notesDraft,
            deleteConfirm: deleteConfirm,
            deletingId: deletingId,
            totalPages: totalPages,
            load: load,
            openDetail: openDetail,
            savePatch: savePatch,
            confirmDelete: confirmDelete,
            fmtDate: fmtDate,
            fmtDuration: fmtDuration,
            detailStepsForChart: detailStepsForChart,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
