import { describe, expect, it } from 'vitest';
import { defaultPlan, formatClock, planDurationS, stepAt, targetAt, targetCurve, validateSteps, } from './planModel';
describe('validateSteps', () => {
    it('合法计划通过', () => {
        expect(validateSteps(defaultPlan().steps)).toBeNull();
    });
    it('空步骤报错', () => {
        expect(validateSteps([])).toContain('至少');
    });
    it('区间重叠报错', () => {
        const steps = [
            { type: 'pour', startS: 0, endS: 10, targetG: 45 },
            { type: 'pause', startS: 5, endS: 20 },
        ];
        expect(validateSteps(steps)).toContain('重叠');
    });
    it('注水目标不递增报错', () => {
        const steps = [
            { type: 'pour', startS: 0, endS: 10, targetG: 45 },
            { type: 'pour', startS: 10, endS: 20, targetG: 40 },
        ];
        expect(validateSteps(steps)).toContain('递增');
    });
    it('时间无效报错', () => {
        expect(validateSteps([{ type: 'pause', startS: 10, endS: 5 }])).toContain('无效');
        expect(validateSteps([{ type: 'pause', startS: -1, endS: 5 }])).toContain('无效');
    });
});
describe('targetCurve / targetAt', () => {
    const steps = defaultPlan().steps;
    it('目标曲线节点正确', () => {
        const pts = targetCurve(steps);
        expect(pts[0]).toEqual({ tS: 0, wG: 0 });
        // 第一段注水 0-10s 至 45g
        expect(pts).toContainEqual({ tS: 10, wG: 45 });
        // 闷蒸 10-30s 保持 45
        expect(pts).toContainEqual({ tS: 30, wG: 45 });
        // 第二段 30-45s 至 120
        expect(pts).toContainEqual({ tS: 45, wG: 120 });
        // 第三段 55-70s 至 240
        expect(pts).toContainEqual({ tS: 70, wG: 240 });
    });
    it('注水中线性插值', () => {
        expect(targetAt(steps, 5)).toBeCloseTo(22.5, 5);
        // 第三段 55-70s 从 120 至 240：t=67.5 → 120 + 12.5/15*120 = 220
        expect(targetAt(steps, 67.5)).toBeCloseTo(220, 5);
    });
    it('停顿中保持水平', () => {
        expect(targetAt(steps, 20)).toBe(45);
        expect(targetAt(steps, 50)).toBe(120);
    });
    it('步骤间隙与结束', () => {
        // 70-105s 为间隙，保持 240
        expect(targetAt(steps, 80)).toBe(240);
        expect(targetAt(steps, 999)).toBe(240);
        expect(targetAt(steps, -1)).toBe(0);
    });
});
describe('stepAt', () => {
    const steps = defaultPlan().steps;
    it('定位当前与下一步', () => {
        const r = stepAt(steps, 5);
        expect(r.current?.type).toBe('pour');
        expect(r.current?.targetG).toBe(45);
        expect(r.next?.label).toBe('闷蒸');
        expect(r.done).toBe(false);
    });
    it('步骤间隙', () => {
        const r = stepAt(steps, 80);
        expect(r.current).toBeNull();
        expect(r.next?.label).toBe('结束萃取');
    });
    it('结束', () => {
        const r = stepAt(steps, 140);
        expect(r.done).toBe(true);
        expect(r.next).toBeNull();
    });
});
describe('工具', () => {
    it('计划总时长', () => {
        expect(planDurationS(defaultPlan().steps)).toBe(130);
    });
    it('时钟格式', () => {
        expect(formatClock(75)).toBe('01:15');
        expect(formatClock(0)).toBe('00:00');
    });
});
