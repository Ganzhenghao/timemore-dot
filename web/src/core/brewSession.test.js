import { describe, expect, it } from 'vitest';
import { BrewSession } from './brewSession';
describe('BrewSession 手动计时', () => {
    it('开始 → 采样 → 停止 → 载荷', () => {
        const s = new BrewSession();
        s.startTimer(10_000);
        s.onSample(10_100, 0, 0);
        s.onSample(10_200, 5, 2.5);
        s.onSample(10_300, 45, 4);
        expect(s.state).toBe('running');
        expect(s.elapsedMs(10_300)).toBe(300);
        expect(s.samples.length).toBe(3);
        expect(s.waterTotalG).toBe(45);
        s.stop(10_300);
        expect(s.state).toBe('stopped');
        expect(s.elapsedMs(99_999)).toBe(300); // 冻结
        expect(s.isSavable()).toBe(false); // 时长不足 5s
        const payload = s.buildSavePayload('TIMEMORE_Dot');
        expect(payload.durationMs).toBe(300);
        expect(payload.waterTotal).toBe(45);
        expect(payload.peakFlow).toBe(4);
        expect(payload.samples.t).toEqual([100, 200, 300]);
        expect(payload.samples.w).toEqual([0, 50, 450]);
        expect(payload.samples.f).toEqual([0, 25, 40]);
    });
    it('暂停/恢复正确累积', () => {
        const s = new BrewSession();
        s.startTimer(0);
        s.onSample(1000, 10, 0);
        s.pauseTimer(2000); // 累积 2000
        s.onSample(3000, 10, 0); // 暂停期间不采样
        expect(s.samples.length).toBe(1);
        expect(s.elapsedMs(3000)).toBe(2000);
        s.resume(4000);
        s.onSample(4500, 11, 0);
        expect(s.elapsedMs(4500)).toBe(2500);
        s.stop(4500);
        expect(s.elapsedMs(99999)).toBe(2500);
    });
    it('可保存判定', () => {
        const s = new BrewSession();
        s.startTimer(0);
        for (let t = 100; t <= 6000; t += 100)
            s.onSample(t, t / 100, 1);
        s.stop(6000);
        expect(s.isSavable()).toBe(true);
        expect(s.avgFlow).toBe(1);
    });
    it('reset 清空', () => {
        const s = new BrewSession();
        s.startTimer(0);
        s.onSample(100, 5, 1);
        s.planId = 3;
        s.coffeeWeight = 15;
        s.reset();
        expect(s.state).toBe('idle');
        expect(s.samples.length).toBe(0);
        expect(s.planId).toBeNull();
        expect(s.coffeeWeight).toBeNull();
    });
});
describe('BrewSession 自动计时', () => {
    it('预备 → 3s 倒计时 → armed → 注水自动开始', () => {
        const s = new BrewSession();
        s.arm(0, 0);
        expect(s.state).toBe('arming');
        // 倒计时期间注水不触发
        s.onSample(1000, 50, 0);
        expect(s.state).toBe('arming');
        // 3s 后进入 armed
        s.onSample(3100, 0, 0);
        expect(s.state).toBe('armed');
        // 重量上升 ≥1g 自动开始计时
        s.onSample(3200, 1.5, 3);
        expect(s.state).toBe('running');
        expect(s.samples.length).toBe(1);
    });
    it('预备倒计时结束时重新快照基线（期间放容器不误触发）', () => {
        const s = new BrewSession();
        s.arm(0, 0);
        // 2s 时放上 100g 容器
        s.onSample(2000, 100, 0);
        expect(s.state).toBe('arming');
        // 3.1s 倒计时结束，基线重置为 100
        s.onSample(3100, 100, 0);
        expect(s.state).toBe('armed');
        s.onSample(3200, 100.5, 0);
        expect(s.state).toBe('armed');
        s.onSample(3300, 102, 2);
        expect(s.state).toBe('running');
    });
    it('取消预备', () => {
        const s = new BrewSession();
        s.arm(0, 0);
        s.cancelArm();
        expect(s.state).toBe('idle');
        // armed 状态也可取消
        s.arm(0, 0);
        s.onSample(3100, 0, 0);
        s.cancelArm();
        expect(s.state).toBe('idle');
    });
});
