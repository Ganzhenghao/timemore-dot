/**
 * Web Bluetooth 客户端：仅适配 Timemore DOT（TES017）。
 * Chrome 桌面端 + localhost 安全上下文运行。
 *
 * 连接流程：requestDevice（需用户手势）→ GATT → 订阅 0xFFF1 通知 →
 * 初始化读取序列 → 10s 保活周期（官方 App 行为，HW 命令被接受的前提）。
 */
import { buildRead, buildWrite, CMD_BATTERY, CMD_DEVICE_NAME, CMD_FIRMWARE, CMD_INIT13, CMD_KEEPALIVE, CMD_POWER_OFF, CMD_TARE, CMD_TIMER, CMD_UNIT, DOT_MODEL_NUMBER, FRAME_KEEPALIVE_WRITE, FRAME_TARE, FRAME_TIMER_PAUSE, FRAME_TIMER_RESET, FRAME_TIMER_START, parseFrame, UUID_DEVICE_INFO_SERVICE, UUID_FIRMWARE_REVISION, UUID_MANUFACTURER, UUID_MODEL_NUMBER, UUID_NOTIFY_CHAR, UUID_SERVICE, UUID_WRITE_CHAR, } from './frames';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** HW 写命令需要近期保活 ACK 才会被秤接受（HCI 逆向结论） */
const CONTROL_ACK_STALE_MS = 12_000;
const CONTROL_ACK_WAIT_MS = 4_000;
const WRITE_ACK_WAIT_MS = 1_500;
export class ScaleClient {
    cb;
    isSimulator = false;
    device = null;
    writeChar = null;
    writeQueue = Promise.resolve();
    keepaliveTimer = null;
    lastKeepaliveAck = 0;
    deviceInfo = {};
    /** 等待写 ACK 的监听器（waitWriteAck 注册，各自核对命令字） */
    ackWaiters = new Set();
    constructor(cb) {
        this.cb = cb;
    }
    get isConnected() {
        return this.device?.gatt?.connected ?? false;
    }
    get info() {
        return this.deviceInfo;
    }
    /** 连接新设备（必须由用户手势触发，如按钮点击） */
    async connect(opts = {}) {
        if (!navigator.bluetooth) {
            throw new Error('当前浏览器不支持 Web Bluetooth，请使用桌面版 Chrome');
        }
        this.cb.onStateChange('connecting');
        try {
            this.device = await navigator.bluetooth.requestDevice({
                ...(opts.showAllDevices
                    ? { acceptAllDevices: true }
                    : { filters: [{ namePrefix: 'TIMEMORE' }] }),
                optionalServices: [UUID_SERVICE, UUID_DEVICE_INFO_SERVICE],
            });
            this.device.addEventListener('gattserverdisconnected', () => this.handleDisconnect());
            this.deviceInfo = { bleName: this.device.name ?? undefined };
            this.cb.onDeviceInfo({ ...this.deviceInfo });
            await this.setupGatt();
        }
        catch (e) {
            this.cb.onStateChange('disconnected');
            throw e;
        }
    }
    /** 重连已配对设备（免用户手势；页面刷新后引用丢失需重新 connect） */
    async reconnect() {
        if (!this.device)
            throw new Error('没有可重连的设备，请重新连接');
        this.cb.onStateChange('connecting');
        try {
            await this.setupGatt();
        }
        catch (e) {
            this.cb.onStateChange('disconnected');
            throw e;
        }
    }
    async disconnect() {
        this.stopKeepalive();
        if (this.device?.gatt?.connected) {
            this.device.gatt.disconnect();
        }
        else {
            this.handleDisconnect();
        }
    }
    // ── 命令 ─────────────────────────────────────────────────────────────
    /** 硬件去皮。返回 false 表示未收到 ACK（调用方回退软件去皮） */
    async tare() {
        return this.sendHwCommand(FRAME_TARE, CMD_TARE);
    }
    async timerStart() {
        return this.sendHwCommand(FRAME_TIMER_START, CMD_TIMER);
    }
    async timerPause() {
        return this.sendHwCommand(FRAME_TIMER_PAUSE, CMD_TIMER);
    }
    async timerReset() {
        return this.sendHwCommand(FRAME_TIMER_RESET, CMD_TIMER);
    }
    async powerOff() {
        return this.sendHwCommand(buildWrite(CMD_POWER_OFF), CMD_POWER_OFF);
    }
    // ── 内部 ─────────────────────────────────────────────────────────────
    async setupGatt() {
        const server = this.device.gatt;
        if (!server.connected) {
            await server.connect();
        }
        const service = await server.getPrimaryService(UUID_SERVICE);
        const notifyChar = await service.getCharacteristic(UUID_NOTIFY_CHAR);
        this.writeChar = await service.getCharacteristic(UUID_WRITE_CHAR);
        await notifyChar.startNotifications();
        notifyChar.addEventListener('characteristicvaluechanged', (evt) => {
            const dv = evt.target.value;
            if (!dv)
                return;
            const event = parseFrame(dv);
            if (event)
                this.handleEvent(event);
        });
        this.cb.onStateChange('connected');
        void this.readDeviceInfo();
        await this.sendInitSequence();
        this.startKeepalive();
    }
    handleEvent(e) {
        for (const waiter of [...this.ackWaiters])
            waiter(e);
        if (e.type === 'writeAck' && e.cmd === CMD_KEEPALIVE) {
            this.lastKeepaliveAck = Date.now();
        }
        if (e.type === 'readResp') {
            if (e.cmd === CMD_DEVICE_NAME) {
                this.deviceInfo = { ...this.deviceInfo, scaleName: new TextDecoder().decode(e.data) };
                this.cb.onDeviceInfo({ ...this.deviceInfo });
            }
            else if (e.cmd === CMD_FIRMWARE) {
                this.deviceInfo = { ...this.deviceInfo, firmware: new TextDecoder().decode(e.data) };
                this.cb.onDeviceInfo({ ...this.deviceInfo });
            }
        }
        this.cb.onEvent(e);
    }
    async readDeviceInfo() {
        try {
            const svc = await this.device.gatt.getPrimaryService(UUID_DEVICE_INFO_SERVICE);
            const readStr = async (uuid) => {
                try {
                    const c = await svc.getCharacteristic(uuid);
                    const v = await c.readValue();
                    return new TextDecoder().decode(v);
                }
                catch {
                    return undefined;
                }
            };
            const modelNumber = await readStr(UUID_MODEL_NUMBER);
            this.deviceInfo = {
                ...this.deviceInfo,
                modelNumber,
                firmware: (await readStr(UUID_FIRMWARE_REVISION)) ?? this.deviceInfo.firmware,
                manufacturer: await readStr(UUID_MANUFACTURER),
                modelMismatch: !!modelNumber && modelNumber !== DOT_MODEL_NUMBER,
            };
            this.cb.onDeviceInfo({ ...this.deviceInfo });
        }
        catch {
            // Device Information Service 读取失败不阻塞连接
        }
    }
    async sendInitSequence() {
        // 官方 App 初始化读取序列 + 文档命令；0x13/0x08 为抓包观测值，无害保留
        const cmds = [CMD_FIRMWARE, CMD_BATTERY, CMD_TIMER, CMD_UNIT, CMD_DEVICE_NAME, CMD_INIT13, CMD_KEEPALIVE];
        for (const cmd of cmds) {
            this.enqueue(buildRead(cmd));
        }
    }
    startKeepalive() {
        this.stopKeepalive();
        // 官方 App 每 10s：读 0x08 + 写 0x08（app 活跃标志），HW 命令依赖近期 ACK
        this.enqueue(buildRead(CMD_KEEPALIVE));
        this.enqueue(FRAME_KEEPALIVE_WRITE);
        this.keepaliveTimer = setInterval(() => {
            this.enqueue(buildRead(CMD_KEEPALIVE));
            this.enqueue(FRAME_KEEPALIVE_WRITE);
        }, 10_000);
    }
    stopKeepalive() {
        if (this.keepaliveTimer) {
            clearInterval(this.keepaliveTimer);
            this.keepaliveTimer = null;
        }
    }
    /** HW 写命令：先确保保活 ACK 新鲜，再发送并等待 ACK */
    async sendHwCommand(bytes, cmd) {
        if (!this.isConnected)
            return false;
        if (Date.now() - this.lastKeepaliveAck > CONTROL_ACK_STALE_MS) {
            const ackBefore = this.lastKeepaliveAck;
            this.enqueue(buildRead(CMD_KEEPALIVE));
            this.enqueue(FRAME_KEEPALIVE_WRITE);
            const deadline = Date.now() + CONTROL_ACK_WAIT_MS;
            while (this.lastKeepaliveAck === ackBefore && Date.now() < deadline) {
                await sleep(50);
            }
        }
        const ackPromise = this.waitWriteAck(cmd, WRITE_ACK_WAIT_MS);
        this.enqueue(bytes);
        return ackPromise;
    }
    /** 等待指定命令的写 ACK；超时按失败处理 */
    waitWriteAck(cmd, timeoutMs) {
        return new Promise((resolve) => {
            const onEvent = (e) => {
                if (e.type === 'writeAck' && e.cmd === cmd) {
                    cleanup();
                    resolve(e.ok);
                }
            };
            const timer = setTimeout(() => {
                cleanup();
                resolve(false);
            }, timeoutMs);
            const cleanup = () => {
                clearTimeout(timer);
                this.ackWaiters.delete(onEvent);
            };
            this.ackWaiters.add(onEvent);
        });
    }
    /** 串行写队列，写间隔 ≥100ms（write-without-response 突发会丢包） */
    enqueue(bytes) {
        this.writeQueue = this.writeQueue
            .then(async () => {
            if (!this.writeChar)
                return;
            try {
                await this.writeChar.writeValueWithoutResponse(bytes);
            }
            catch {
                // 单帧写失败不阻塞队列；断线由 gattserverdisconnected 统一处理
            }
            await sleep(100);
        })
            .catch(() => { });
    }
    handleDisconnect() {
        this.stopKeepalive();
        this.cb.onStateChange('disconnected');
    }
}
