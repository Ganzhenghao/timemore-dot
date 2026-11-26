import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = withDefaults(defineProps(), { live: false, currentStep: null, height: 320 });
const canvasRef = ref(null);
const wrapRef = ref(null);
const hover = ref(null);
let resizeObserver = null;
let rafId = 0;
function computeScale(w, h) {
    const lastSampleT = props.samples.length ? props.samples[props.samples.length - 1].t / 1000 : 0;
    const targetT = props.targetCurve?.length ? props.targetCurve[props.targetCurve.length - 1].tS : 0;
    const xMax = Math.max(30, lastSampleT, targetT) * 1.06 + 2;
    let wMax = 50;
    for (const s of props.samples)
        if (s.w > wMax)
            wMax = s.w;
    if (props.targetCurve)
        for (const p of props.targetCurve)
            if (p.wG > wMax)
                wMax = p.wG;
    // nice ticks：刻度步长取好看值（10/20/25/50/…），保证刻度均匀且为整数
    const raw = wMax * 1.05 + 5;
    const niceSteps = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000];
    const tickStep = niceSteps.find((s) => s >= raw / 4) ?? 10000;
    const yMax = Math.ceil(raw / tickStep) * tickStep;
    const padL = 44;
    const padR = 14;
    const padT = 26;
    const padB = 24;
    return {
        xMax,
        yMax,
        tickStep,
        px: (tS) => padL + (tS / xMax) * (w - padL - padR),
        py: (wG) => h - padB - (Math.max(0, wG) / yMax) * (h - padT - padB),
    };
}
function draw() {
    const cv = canvasRef.value;
    const wrap = wrapRef.value;
    if (!cv || !wrap)
        return;
    const w = wrap.clientWidth;
    const h = props.height;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
        cv.width = w * dpr;
        cv.height = h * dpr;
    }
    const ctx = cv.getContext('2d');
    if (!ctx)
        return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const sc = computeScale(w, h);
    const AC = '#c8a96e';
    const MUT = '#555';
    const FAINT = '#222';
    // ── 步骤背景与分界 ─────────────────────────────────────
    if (props.steps?.length) {
        for (const s of props.steps) {
            const x0 = sc.px(s.startS);
            const x1 = sc.px(s.endS);
            const isCurrent = props.live && props.currentStep === s;
            ctx.fillStyle = s.type === 'pour' ? 'rgba(200,169,110,0.05)' : 'rgba(122,207,224,0.04)';
            if (isCurrent)
                ctx.fillStyle = s.type === 'pour' ? 'rgba(200,169,110,0.13)' : 'rgba(122,207,224,0.10)';
            ctx.fillRect(x0, 24, x1 - x0, h - 48);
            ctx.strokeStyle = FAINT;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x1 + 0.5, 24);
            ctx.lineTo(x1 + 0.5, h - 24);
            ctx.stroke();
            // 步骤标签（pour 显示目标克重）
            const label = s.label ?? (s.type === 'pour' ? `注水→${s.targetG}g` : '停顿');
            ctx.fillStyle = isCurrent ? AC : MUT;
            ctx.font = '11px system-ui';
            ctx.textAlign = 'left';
            if (x1 - x0 > 40) {
                ctx.fillText(label, x0 + 4, 16);
            }
        }
    }
    // ── 网格与坐标 ──────────────────────────────────────────
    ctx.strokeStyle = FAINT;
    ctx.lineWidth = 1;
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = MUT;
    ctx.textAlign = 'right';
    for (let wG = 0; wG <= sc.yMax; wG += sc.tickStep) {
        const y = sc.py(wG);
        ctx.beginPath();
        ctx.moveTo(44, y);
        ctx.lineTo(w - 14, y);
        ctx.stroke();
        ctx.fillText(`${wG}`, 38, y + 4);
    }
    ctx.textAlign = 'center';
    const stepSec = sc.xMax > 300 ? 60 : sc.xMax > 120 ? 30 : 15;
    for (let t = 0; t <= sc.xMax; t += stepSec) {
        const x = sc.px(t);
        ctx.fillStyle = MUT;
        ctx.fillText(`${t}`, x, h - 8);
    }
    // ── 目标曲线（虚线） ────────────────────────────────────
    if (props.targetCurve?.length && props.targetCurve.length >= 2) {
        ctx.strokeStyle = 'rgba(200,169,110,0.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        props.targetCurve.forEach((p, i) => {
            const x = sc.px(p.tS);
            const y = sc.py(p.wG);
            if (i === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
    }
    // ── 实际曲线 ────────────────────────────────────────────
    const pts = props.samples;
    if (pts.length >= 2) {
        const grad = ctx.createLinearGradient(0, 26, 0, h - 24);
        grad.addColorStop(0, 'rgba(200,169,110,0.22)');
        grad.addColorStop(1, 'rgba(200,169,110,0)');
        ctx.beginPath();
        pts.forEach((s, i) => {
            const x = sc.px(s.t / 1000);
            const y = sc.py(s.w);
            if (i === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        });
        const lastX = sc.px(pts[pts.length - 1].t / 1000);
        const firstX = sc.px(pts[0].t / 1000);
        ctx.lineTo(lastX, h - 24);
        ctx.lineTo(firstX, h - 24);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        pts.forEach((s, i) => {
            const x = sc.px(s.t / 1000);
            const y = sc.py(s.w);
            if (i === 0)
                ctx.moveTo(x, y);
            else
                ctx.lineTo(x, y);
        });
        ctx.strokeStyle = AC;
        ctx.lineWidth = 1.8;
        ctx.lineJoin = 'round';
        ctx.stroke();
        if (props.live) {
            const last = pts[pts.length - 1];
            const x = sc.px(last.t / 1000);
            const y = sc.py(last.w);
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = AC;
            ctx.shadowColor = AC;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
    // ── hover 提示 ──────────────────────────────────────────
    if (hover.value && pts.length) {
        const hv = hover.value;
        ctx.strokeStyle = 'rgba(240,236,228,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hv.x, 24);
        ctx.lineTo(hv.x, h - 24);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(hv.x, hv.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f0ece4';
        ctx.fill();
        const text = `${Math.floor(hv.tS / 60)}:${String(Math.floor(hv.tS % 60)).padStart(2, '0')}  ${hv.wG.toFixed(1)}g  ${hv.fGps.toFixed(1)}g/s`;
        ctx.font = '12px ui-monospace, monospace';
        const tw = ctx.measureText(text).width + 16;
        const bx = Math.min(Math.max(hv.x + 10, 44), w - 14 - tw);
        ctx.fillStyle = 'rgba(30,30,30,0.95)';
        ctx.strokeStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.roundRect(bx, 30, tw, 24, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f0ece4';
        ctx.textAlign = 'left';
        ctx.fillText(text, bx + 8, 46);
    }
}
function requestRedraw() {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(draw);
}
function onMove(e) {
    const cv = canvasRef.value;
    const pts = props.samples;
    if (!cv || !pts.length)
        return;
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const sc = computeScale(w, props.height);
    const tPx = (x - 44) / (w - 58);
    const tMs = tPx * sc.xMax * 1000;
    // 找最近样本
    let best = pts[0];
    let bestD = Infinity;
    for (const s of pts) {
        const d = Math.abs(s.t - tMs);
        if (d < bestD) {
            bestD = d;
            best = s;
        }
    }
    hover.value = { x: sc.px(best.t / 1000), y: sc.py(best.w), tS: best.t / 1000, wG: best.w, fGps: best.f };
    requestRedraw();
}
function onLeave() {
    hover.value = null;
    requestRedraw();
}
onMounted(() => {
    resizeObserver = new ResizeObserver(requestRedraw);
    if (wrapRef.value)
        resizeObserver.observe(wrapRef.value);
    requestRedraw();
});
onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    cancelAnimationFrame(rafId);
});
watch(() => [props.samples.length, props.targetCurve, props.currentStep, props.height], requestRedraw, { deep: true });
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_withDefaultsArg = (function (t) { return t; })({ live: false, currentStep: null, height: 320 });
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "wrapRef",
    ...{ class: "chart-wrap" },
});
/** @type {typeof __VLS_ctx.wrapRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ...{ onMousemove: (__VLS_ctx.onMove) },
    ...{ onMouseleave: (__VLS_ctx.onLeave) },
    ref: "canvasRef",
    ...{ style: ({ height: `${__VLS_ctx.height}px` }) },
});
/** @type {typeof __VLS_ctx.canvasRef} */ ;
/** @type {__VLS_StyleScopedClasses['chart-wrap']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            canvasRef: canvasRef,
            wrapRef: wrapRef,
            onMove: onMove,
            onLeave: onLeave,
        };
    },
    __typeProps: {},
    props: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeProps: {},
    props: {},
});
; /* PartiallyEnd: #4569/main.vue */
