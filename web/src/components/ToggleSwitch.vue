<script setup lang="ts">
/**
 * 开关：Chrome 尚未支持 input switch 属性，采用 styled checkbox + role="switch"
 * （modern-web-guidance switch 指南的回退方案），行为与原生 checkbox 一致。
 */
defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

function onInput(e: Event): void {
  emit('update:modelValue', (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <label class="switch-row" :class="{ disabled }">
    <span class="switch-label">{{ label }}</span>
    <input
      :id="`sw-${label}`"
      type="checkbox"
      role="switch"
      class="switch-input"
      :checked="modelValue"
      :disabled="disabled"
      @change="onInput"
    />
  </label>
</template>

<style scoped>
.switch-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.switch-row.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.switch-label {
  font-size: 13px;
  color: var(--tx-mute);
}

.switch-input {
  appearance: none;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--bg-raise);
  border: 1px solid var(--bd-strong);
  position: relative;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  margin: 0;
  flex-shrink: 0;
}

.switch-input::before {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--tx-mute);
  transition:
    transform 0.2s,
    background 0.2s;
}

.switch-input:checked {
  background: rgba(200, 169, 110, 0.25);
  border-color: var(--ac);
}

.switch-input:checked::before {
  transform: translateX(18px);
  background: var(--ac);
}

.switch-input:focus-visible {
  outline: 2px solid var(--ac);
  outline-offset: 2px;
}
</style>
