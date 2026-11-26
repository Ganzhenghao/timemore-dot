/**
 * 称量模式 store：手冲 / 标准。
 * 模式切换入口在顶栏，状态需跨 App 与 WeighView 共享，故独立成 store 并持久化。
 */
import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useSessionStore } from './session'
import { useToastStore } from './toast'

export type WeighMode = 'pour' | 'standard'

export const useModeStore = defineStore('mode', () => {
  const session = useSessionStore()
  const toast = useToastStore()

  const mode = ref<WeighMode>((localStorage.getItem('mode') as WeighMode) || 'pour')

  function setMode(m: WeighMode): void {
    if (session.running || session.paused) {
      toast.push('请先停止当前计时再切换模式', 'warn')
      return
    }
    mode.value = m
    localStorage.setItem('mode', m)
  }

  return { mode, setMode }
})
