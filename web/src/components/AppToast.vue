<script setup lang="ts">
/**
 * Toast 容器：按 modern-web-guidance 用 popover="manual" 置顶层展示
 * （模态框打开时 toast 仍可见），容器 role="region" 便于屏幕阅读器定位；
 * 每条含显式关闭按钮。
 */
import { useToastStore } from '../stores/toast'

const toast = useToastStore()

function mount(el: unknown): void {
  if (el instanceof HTMLElement && typeof el.showPopover === 'function') {
    if (!el.matches(':popover-open')) {
      try {
        el.showPopover()
      } catch {
        /* 已显示或不可用忽略 */
      }
    }
  }
}

const kindColor: Record<string, string> = {
  ok: 'var(--ok)',
  err: 'var(--err)',
  warn: 'var(--warn)',
  info: 'var(--ac)',
}
</script>

<template>
  <div role="region" aria-label="通知" class="toast-region">
    <div
      v-for="(t, i) in toast.items"
      :key="t.id"
      :ref="mount"
      popover="manual"
      class="toast"
      :style="{ '--kind': kindColor[t.kind] ?? 'var(--ac)', bottom: `${20 + i * 56}px` }"
    >
      <span class="dot" aria-hidden="true"></span>
      <span class="text">{{ t.text }}</span>
      <button class="close" type="button" :aria-label="`关闭通知：${t.text}`" @click="toast.dismiss(t.id)">×</button>
    </div>
  </div>
</template>

<style scoped>
.toast-region {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 100;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-soft);
  border: 1px solid var(--bd-strong);
  border-left: 3px solid var(--kind, var(--ac));
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--tx);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  width: max-content;
  max-width: 340px;
  /* 覆盖 popover 默认视口居中，固定到右下角 */
  position: fixed;
  inset: auto;
  right: 20px;
  margin: 0;
}

.toast .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--kind, var(--ac));
  flex-shrink: 0;
}

.toast .text {
  line-height: 1.5;
}

.toast .close {
  color: var(--tx-mute);
  font-size: 16px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 3px;
}

.toast .close:hover {
  color: var(--tx);
  background: var(--bg-raise);
}

@media (prefers-reduced-motion: no-preference) {
  .toast {
    transition:
      opacity 0.25s,
      transform 0.25s,
      display 0.25s allow-discrete;
  }
}
</style>
