/**
 * Toast 通知 store。按 modern-web-guidance persistent-toast-notifications：
 * 消息为非关键性提示；短暂显示后自动关闭，也提供显式关闭。
 */
import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface ToastItem {
  id: number
  text: string
  kind: 'ok' | 'err' | 'warn' | 'info'
}

let seq = 1

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])

  function push(text: string, kind: ToastItem['kind'] = 'info', durationMs = 3500): void {
    const id = seq++
    items.value.push({ id, text, kind })
    if (items.value.length > 5) items.value.shift()
    if (durationMs > 0) {
      setTimeout(() => dismiss(id), durationMs)
    }
  }

  function dismiss(id: number): void {
    items.value = items.value.filter((t) => t.id !== id)
  }

  return { items, push, dismiss }
})
