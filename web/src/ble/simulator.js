/**
 * 仿真秤：产生与真机相同的协议帧字节流，经同一 parseFrame 解析路径分发事件。
 * 用于无硬件开发与端到端 GUI 测试；支持速率注水与脚本化场景。
 */
import { buildWeightNotify, CMD_TARE, CMD_TIMER, CMD_POWER_OFF, parseFrame, } from './frames';
const TICK_MS = 100;
export class ScaleSimulator {
    onEvent;
    onStateChange;
    isSimulator = true;
    connected = false;
    timer = null;
    scriptTimer = null;
    /** 重量，0.1g 为单位避免浮点漂移 */
    weightTenths = 0;
    /** 注水速率 g/s */
    pourRateGps = 0;
    simTimerRunning = false;
    simTimerStart = 0;
    simTimerBaseS = 0;
    /** 上次 tick 真实时间：后台标签页 setInterval 被节流时按真实时间差推进，保证注水速率不失真 */
    lastTickAt = 0;
    infoData = {
        bleName: 'TIMEMORE_Dot_SIM',
        modelNumber: 'TES017',
        manufacturer: 'TIMEMORE (仿真)',
        scaleName: '仿真秤',
        firmware: 'sim-1.0',
    };
    constructor(onEvent, onStateChange = () => { }) {
        this.onEvent = onEvent;
        this.onStateChange = onStateChange;
    }
    get isConnected() {
        return this.connected;
    }
    get info() {
        return this.infoData;
    }
    async connect() {
        this.connected = true;
        this.onStateChange('connected');
        this.emit({ type: 'battery', bars: 4, percent: 92 });
        this.lastTickAt = Date.now();
        this.timer = setInterval(() => this.tick(), TICK_MS);
    }
    async reconnect() {
        await this.connect();
    }
    async disconnect() {
        this.connected = false;
        this.pourRateGps = 0;
        this.stopScript();
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.onStateChange('disconnected');
    }
    // ── 仿真控制 ─────────────────────────────────────────────────────────
    /** 设定注水速率 g/s（负值模拟取走重物） */
    setPourRate(gps) {
        this.pourRateGps = gps;
    }
    get currentPourRate() {
        return this.pourRateGps;
    }
    /** 直接设定重量（模拟放容器等） */
    setWeight(g) {
        this.weightTenths = Math.round(g * 10);
    }
    /** 播放注水脚本：按序以指定速率注水指定时长（时间戳驱动，节流下时长不失真） */
    playScript(steps) {
        this.stopScript();
        let idx = 0;
        let stepEndAt = 0;
        this.scriptTimer = setInterval(() => {
            const now = Date.now();
            if (now < stepEndAt)
                return;
            if (idx >= steps.length) {
                this.pourRateGps = 0;
                this.stopScript();
                return;
            }
            const step = steps[idx++];
            this.pourRateGps = step.rateGps;
            stepEndAt = now + step.durMs;
        }, TICK_MS);
    }
    stopScript() {
        if (this.scriptTimer) {
            clearInterval(this.scriptTimer);
            this.scriptTimer = null;
        }
    }
    // ── 命令（与真机一致的 ACK 行为） ──────────────────────────────────────
    async tare() {
        this.weightTenths = 0;
        this.emit({ type: 'writeAck', cmd: CMD_TARE, ok: true });
        return true;
    }
    async timerStart() {
        this.simTimerRunning = true;
        this.simTimerStart = Date.now();
        this.emit({ type: 'timerState', state: 1 });
        this.emit({ type: 'writeAck', cmd: CMD_TIMER, ok: true });
        return true;
    }
    async timerPause() {
        this.simTimerBaseS += (Date.now() - this.simTimerStart) / 1000;
        this.simTimerRunning = false;
        this.emit({ type: 'timerState', state: 2 });
        this.emit({ type: 'writeAck', cmd: CMD_TIMER, ok: true });
        return true;
    }
    async timerReset() {
        this.simTimerRunning = false;
        this.simTimerBaseS = 0;
        this.emit({ type: 'timerState', state: 3 });
        this.emit({ type: 'writeAck', cmd: CMD_TIMER, ok: true });
        return true;
    }
    async powerOff() {
        this.emit({ type: 'writeAck', cmd: CMD_POWER_OFF, ok: true });
        await this.disconnect();
        return true;
    }
    // ── 内部 ─────────────────────────────────────────────────────────────
    tick() {
        const now = Date.now();
        // 真实时间差推进；上限 1s 防止标签页挂起后醒来时注入跳变
        const dtSec = Math.min(1, Math.max(0, (now - this.lastTickAt) / 1000));
        this.lastTickAt = now;
        this.weightTenths += this.pourRateGps * dtSec * 10;
        const timerS = this.simTimerRunning
            ? this.simTimerBaseS + (now - this.simTimerStart) / 1000
            : this.simTimerBaseS;
        const bytes = buildWeightNotify(this.weightTenths / 10, this.pourRateGps, timerS);
        const event = parseFrame(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
        if (event)
            this.emit(event);
    }
    emit(e) {
        if (this.connected)
            this.onEvent(e);
    }
}
