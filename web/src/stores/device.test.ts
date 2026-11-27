import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { ScaleEvent } from '../ble/frames'
import { useDeviceStore } from './device'

const simulatorMock = vi.hoisted(() => ({
  readBattery: vi.fn(),
  emitEvent: (_event: ScaleEvent) => {},
}))

vi.mock('../ble/simulator', () => ({
  ScaleSimulator: class {
    readonly isSimulator = true
    readonly info = {}
    isConnected = false
    private onEvent: (event: ScaleEvent) => void
    private onStateChange: (state: 'disconnected' | 'connecting' | 'connected') => void

    constructor(
      onEvent: (event: ScaleEvent) => void,
      onStateChange: (state: 'disconnected' | 'connecting' | 'connected') => void,
    ) {
      this.onEvent = onEvent
      this.onStateChange = onStateChange
      simulatorMock.emitEvent = (event) => this.onEvent(event)
    }

    async connect(): Promise<void> {
      this.isConnected = true
      this.onStateChange('connected')
    }

    async reconnect(): Promise<void> {
      await this.connect()
    }

    async disconnect(): Promise<void> {
      this.isConnected = false
      this.onStateChange('disconnected')
    }

    async tare(): Promise<boolean> {
      return true
    }

    readBattery(): void {
      simulatorMock.readBattery()
    }

    async timerStart(): Promise<boolean> {
      return true
    }

    async timerPause(): Promise<boolean> {
      return true
    }

    async timerReset(): Promise<boolean> {
      return true
    }

    async powerOff(): Promise<boolean> {
      return true
    }
  },
}))

describe('device store 电量补读', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    simulatorMock.readBattery.mockReset()
    simulatorMock.emitEvent = () => {}
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('连接后每 2s 依次补读，收到电量后停止', async () => {
    const device = useDeviceStore()
    device.isSimulator = true

    await device.connectSim()
    expect(device.batteryPercent).toBeNull()

    await vi.advanceTimersByTimeAsync(1_999)
    expect(simulatorMock.readBattery).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(simulatorMock.readBattery).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(simulatorMock.readBattery).toHaveBeenCalledTimes(2)

    simulatorMock.emitEvent({ type: 'battery', bars: 3, percent: 87 })
    expect(device.batteryPercent).toBe(87)

    await vi.advanceTimersByTimeAsync(6_000)
    expect(simulatorMock.readBattery).toHaveBeenCalledTimes(2)

    await device.disconnect()
  })
})
