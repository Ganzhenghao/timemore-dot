/**
 * 统一秤接口：真机（ScaleClient）与仿真秤（ScaleSimulator）共同实现，
 * 供 device store 无感切换。
 */
import type { ConnectionState, DeviceInfo } from './scaleClient'
import type { ScaleSimulator } from './simulator'

export interface Scale {
  readonly isSimulator: boolean
  readonly isConnected: boolean
  readonly info: DeviceInfo
  connect(opts?: { showAllDevices?: boolean }): Promise<void>
  reconnect(): Promise<void>
  disconnect(): Promise<void>
  /** 硬件去皮；返回 false 表示未确认成功（调用方回退软件去皮） */
  tare(): Promise<boolean>
  /** 主动读取电量（连接后补读 / 定时刷新；结果通过 battery 事件返回） */
  readBattery(): void
  timerStart(): Promise<boolean>
  timerPause(): Promise<boolean>
  timerReset(): Promise<boolean>
  powerOff(): Promise<boolean>
}

export interface ScaleStateCallbacks {
  onStateChange: (state: ConnectionState) => void
  onDeviceInfo: (info: DeviceInfo) => void
}

export type { ConnectionState, DeviceInfo, ScaleSimulator }
