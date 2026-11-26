<script setup lang="ts">
/**
 * 确认对话框：原生 <dialog> + showModal()（modern-web-guidance dialog 指南）。
 * 破坏性操作时 autofocus 落在安全按钮（取消）。
 */
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    message?: string
    confirmText?: string
    cancelText?: string
    danger?: boolean
  }>(),
  { confirmText: '确认', cancelText: '取消', danger: false },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
  'update:open': [v: boolean]
}>()

const el = ref<HTMLDialogElement | null>(null)

watch(
  () => props.open,
  (v) => {
    if (!el.value) return
    if (v && !el.value.open) el.value.showModal()
    else if (!v && el.value.open) el.value.close()
  },
)

function onConfirm(): void {
  emit('confirm')
  emit('update:open', false)
}

function onClose(): void {
  emit('cancel')
  emit('update:open', false)
}
</script>

<template>
  <dialog
    ref="el"
    aria-labelledby="confirm-title"
    @close="onClose"
  >
    <h2 id="confirm-title">{{ title }}</h2>
    <p v-if="message" class="msg">{{ message }}</p>
    <form method="dialog" class="actions">
      <button :value="'cancel'" class="btn ghost" autofocus>取消</button>
      <button type="button" class="btn" :class="danger ? 'danger' : 'primary'" @click="onConfirm">
        {{ confirmText }}
      </button>
    </form>
  </dialog>
</template>

<style scoped>
dialog {
  background: var(--bg-soft);
  color: var(--tx);
  border: 1px solid var(--bd-strong);
  border-radius: 8px;
  padding: 24px;
  min-width: 320px;
  max-width: 420px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}

dialog::backdrop {
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}

/* modern-web-guidance: 防止滚动穿透 */
dialog:modal {
  overscroll-behavior: contain;
}

h2 {
  font-size: 16px;
  margin-bottom: 8px;
  color: var(--tx);
}

.msg {
  color: var(--tx-mute);
  font-size: 13px;
  line-height: 1.7;
  margin-bottom: 20px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn {
  padding: 8px 18px;
  border-radius: 4px;
  font-size: 13px;
  border: 1px solid var(--bd-strong);
  cursor: pointer;
  background: var(--bg-raise);
}

.btn.ghost {
  background: none;
  color: var(--tx-mute);
}

.btn.ghost:hover {
  color: var(--tx);
}

.btn.primary {
  background: var(--ac);
  border-color: var(--ac);
  color: #141414;
  font-weight: 600;
}

.btn.danger {
  background: var(--err);
  border-color: var(--err);
  color: #fff;
  font-weight: 600;
}
</style>
