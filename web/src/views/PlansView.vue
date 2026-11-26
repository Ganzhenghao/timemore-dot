<script setup lang="ts">
/**
 * 冲煮计划视图：列表 + 原生 dialog 编辑器（步骤表 + 目标曲线预览）。
 * 校验遵循 modern-web-guidance：提交时集中提示，input 清除错误。
 */
import { computed, reactive, ref, watch } from 'vue'
import { usePlansStore } from '../stores/plans'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import BrewChart from '../components/BrewChart.vue'
import {
  defaultPlan,
  formatClock,
  planDurationS,
  targetCurve,
  validateSteps,
  type BrewPlan,
} from '../core/planModel'

const plans = usePlansStore()

const editorOpen = ref(false)
const editorEl = ref<HTMLDialogElement | null>(null)
const editorError = ref('')
const deletingId = ref<number | null>(null)
const deleteConfirm = ref(false)

// 原生 dialog：按 modern-web-guidance 用 showModal() 而非 open 属性
watch(editorOpen, (v) => {
  if (v) editorEl.value?.showModal()
  else if (editorEl.value?.open) editorEl.value.close()
})

const draft = reactive<BrewPlan>({ name: '', coffeeWeight: null, ratio: null, steps: [] })
const editingId = ref<number | null>(null)

function openCreate(): void {
  editingId.value = null
  Object.assign(draft, { id: undefined, name: '', coffeeWeight: null, ratio: null, steps: [] })
  editorError.value = ''
  editorOpen.value = true
}

function openEdit(plan: BrewPlan): void {
  editingId.value = plan.id ?? null
  Object.assign(draft, JSON.parse(JSON.stringify({ ...plan })))
  editorError.value = ''
  editorOpen.value = true
}

function openCopy(plan: BrewPlan): void {
  editingId.value = null
  Object.assign(draft, JSON.parse(JSON.stringify({ ...plan, id: undefined, name: `${plan.name} 副本` })))
  editorError.value = ''
  editorOpen.value = true
}

function openTemplate(): void {
  editingId.value = null
  Object.assign(draft, JSON.parse(JSON.stringify(defaultPlan())))
  editorError.value = ''
  editorOpen.value = true
}

function addStep(): void {
  const last = draft.steps[draft.steps.length - 1]
  const startS = last ? last.endS : 0
  draft.steps.push({ type: 'pour', startS, endS: startS + 10, targetG: undefined, label: '' })
}

function removeStep(i: number): void {
  draft.steps.splice(i, 1)
}

async function submit(): Promise<void> {
  editorError.value = validateSteps(draft.steps) ?? ''
  if (editorError.value) return
  const payload: BrewPlan = {
    ...draft,
    id: editingId.value ?? undefined,
    coffeeWeight: draft.coffeeWeight || null,
    ratio: draft.ratio || null,
  }
  const ok = await plans.save(payload)
  if (ok) editorOpen.value = false
}

watch(
  () => draft.steps,
  () => {
    // 修改即清除提交错误，避免边改边报
    if (editorError.value) editorError.value = validateSteps(draft.steps) ?? ''
  },
  { deep: true },
)

const draftCurve = computed(() => (validateSteps(draft.steps) ? [] : targetCurve(draft.steps)))
const previewSamples = computed(() => {
  // 用目标曲线点生成静态样本以便 BrewChart 渲染实际曲线区
  return draftCurve.value.map((p) => ({ t: p.tS * 1000, w: p.wG, f: 0 }))
})

async function confirmDelete(): Promise<void> {
  if (deletingId.value == null) return
  await plans.remove(deletingId.value)
  deletingId.value = null
}
</script>

<template>
  <div class="plans">
    <header class="page-head">
      <h1>冲煮计划</h1>
      <div class="head-actions">
        <button class="btn" @click="openTemplate()">从模板新建</button>
        <button class="btn primary" @click="openCreate()">新建计划</button>
      </div>
    </header>

    <div v-if="!plans.loaded || plans.loading" class="empty">加载中…</div>
    <div v-else-if="plans.list.length === 0" class="empty">
      <p>还没有冲煮计划</p>
      <button class="btn primary" @click="openTemplate()">用「经典三段式」模板创建</button>
    </div>

    <ul v-else class="plan-list">
      <li v-for="p in plans.list" :key="p.id" class="plan-card">
        <div class="card-main">
          <div class="card-name">{{ p.name }}</div>
          <div class="card-meta num">
            <span v-if="p.coffeeWeight">粉 {{ p.coffeeWeight }}g</span>
            <span v-if="p.ratio">比例 1:{{ p.ratio }}</span>
            <span>{{ p.steps.length }} 步 · {{ formatClock(planDurationS(p.steps)) }}</span>
          </div>
          <div class="card-steps">
            <span
              v-for="(s, i) in p.steps"
              :key="i"
              class="step-chip"
              :class="s.type"
              :title="`${s.label ?? ''} ${formatClock(s.startS)}–${formatClock(s.endS)}${s.targetG ? ' → ' + s.targetG + 'g' : ''}`"
            >
              {{ s.label ?? (s.type === 'pour' ? `→${s.targetG}g` : '停顿') }}
            </span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn tiny" @click="openEdit(p)">编辑</button>
          <button class="btn tiny" @click="openCopy(p)">复制</button>
          <button class="btn tiny danger" @click="deletingId = p.id; deleteConfirm = true">删除</button>
        </div>
      </li>
    </ul>

    <!-- 编辑器：原生 dialog -->
    <dialog ref="editorEl" class="editor" @close="editorOpen = false">
      <div v-if="editorOpen" class="editor-body">
        <h2>{{ editingId ? '编辑计划' : '新建计划' }}</h2>

        <form class="form" @submit.prevent="submit">
          <div class="field">
            <label for="plan-name">计划名称</label>
            <input
              id="plan-name"
              v-model.trim="draft.name"
              name="plan-name"
              required
              maxlength="64"
              :aria-invalid="!!editorError"
            />
          </div>
          <div class="field-row">
            <div class="field">
              <label for="plan-coffee">咖啡粉量 (g)</label>
              <input id="plan-coffee" v-model.number="draft.coffeeWeight" name="plan-coffee" type="text" inputmode="decimal" />
            </div>
            <div class="field">
              <label for="plan-ratio">目标粉水比 (1:x)</label>
              <input id="plan-ratio" v-model.number="draft.ratio" name="plan-ratio" type="text" inputmode="decimal" />
            </div>
          </div>

          <fieldset class="steps-field">
            <legend>步骤（时间单位：秒）</legend>
            <table class="steps-table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>标签</th>
                  <th>开始</th>
                  <th>结束</th>
                  <th>目标 g</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(s, i) in draft.steps" :key="i">
                  <td>
                    <select v-model="s.type" :aria-label="`步骤 ${i + 1} 类型`">
                      <option value="pour">注水</option>
                      <option value="pause">停顿</option>
                    </select>
                  </td>
                  <td><input v-model.trim="s.label" :aria-label="`步骤 ${i + 1} 标签`" maxlength="32" placeholder="如 闷蒸" /></td>
                  <td><input v-model.number="s.startS" :aria-label="`步骤 ${i + 1} 开始秒`" type="text" inputmode="numeric" required /></td>
                  <td><input v-model.number="s.endS" :aria-label="`步骤 ${i + 1} 结束秒`" type="text" inputmode="numeric" required /></td>
                  <td>
                    <input
                      v-if="s.type === 'pour'"
                      v-model.number="s.targetG"
                      :aria-label="`步骤 ${i + 1} 目标克重`"
                      type="text"
                      inputmode="decimal"
                      required
                    />
                    <span v-else class="na">—</span>
                  </td>
                  <td><button class="btn tiny danger" type="button" :aria-label="`删除步骤 ${i + 1}`" @click="removeStep(i)">×</button></td>
                </tr>
              </tbody>
            </table>
            <button class="btn tiny" type="button" @click="addStep()">+ 添加步骤</button>
            <p v-if="editorError" class="error-msg" role="alert">{{ editorError }}</p>
          </fieldset>

          <div class="preview">
            <div class="preview-title">目标曲线预览</div>
            <BrewChart :samples="previewSamples" :target-curve="draftCurve" :steps="draft.steps" :height="220" />
          </div>

          <div class="actions">
            <button class="btn ghost" type="button" @click="editorOpen = false">取消</button>
            <button class="btn primary" type="submit">保存计划</button>
          </div>
        </form>
      </div>
    </dialog>

    <ConfirmDialog
      v-model:open="deleteConfirm"
      title="删除冲煮计划？"
      :message="`将删除「${plans.list.find((p) => p.id === deletingId)?.name ?? ''}」，历史记录不受影响。`"
      confirm-text="删除"
      danger
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.plans {
  padding: 24px 32px;
  max-width: 960px;
  margin: 0 auto;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-head h1 {
  font-size: 20px;
  font-weight: 400;
}

.head-actions {
  display: flex;
  gap: 10px;
}

.empty {
  text-align: center;
  color: var(--tx-mute);
  padding: 60px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.plan-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  border: 1px solid var(--bd);
  border-radius: 6px;
  padding: 16px 20px;
  background: var(--bg-soft);
}

.card-name {
  font-size: 15px;
  color: var(--tx);
  margin-bottom: 4px;
}

.card-meta {
  display: flex;
  gap: 16px;
  color: var(--tx-mute);
  font-size: 12px;
  margin-bottom: 8px;
}

.card-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.step-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid var(--bd-strong);
  color: var(--tx-mute);
}

.step-chip.pour {
  border-color: rgba(200, 169, 110, 0.4);
  color: var(--ac);
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn.danger {
  color: var(--err);
  border-color: rgba(224, 85, 85, 0.4);
}

/* 编辑器 */
dialog.editor {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(860px, calc(100vw - 48px));
  max-height: calc(100vh - 64px);
  max-height: calc(100dvh - 64px);
  overflow: auto;
  background: var(--bg);
  color: var(--tx);
  border: 1px solid var(--bd-strong);
  border-radius: 8px;
  padding: 24px 28px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
  overscroll-behavior: contain;
}

dialog.editor::backdrop {
  background: rgba(0, 0, 0, 0.55);
}

.editor h2 {
  font-size: 17px;
  font-weight: 500;
  margin-bottom: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
}

.field label {
  font-size: 12px;
  color: var(--tx-mute);
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.field input,
.steps-field input,
.steps-field select {
  background: var(--bg-raise);
  border: 1px solid var(--bd-strong);
  border-radius: 4px;
  color: var(--tx);
  padding: 8px 10px;
  font-size: 13px;
  width: 100%;
}

.field input:user-invalid,
.steps-field input:user-invalid {
  border-color: var(--err);
  background: rgba(224, 85, 85, 0.08);
}

.steps-field {
  border: 1px solid var(--bd);
  border-radius: 6px;
  padding: 14px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.steps-field legend {
  font-size: 12px;
  color: var(--tx-mute);
  padding: 0 6px;
}

.steps-table {
  width: 100%;
  border-collapse: collapse;
}

.steps-table th {
  font-size: 11px;
  color: var(--tx-mute);
  text-align: left;
  padding: 4px 6px;
  font-weight: 400;
}

.steps-table td {
  padding: 4px 6px;
}

.steps-table td:first-child select {
  width: 76px;
}

.steps-table td input {
  width: 100%;
  min-width: 60px;
}

.na {
  color: var(--tx-faint);
  text-align: center;
  display: block;
}

.error-msg {
  color: var(--err);
  font-size: 12px;
}

.preview {
  border: 1px dashed var(--bd);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
}

.preview-title {
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--tx-mute);
  text-transform: uppercase;
  margin-bottom: 8px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 通用按钮（同其他视图风格） */
.btn {
  padding: 9px 16px;
  border-radius: 4px;
  border: 1px solid var(--bd-strong);
  background: var(--bg-soft);
  color: var(--tx);
  font-size: 13px;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  background: var(--bg-raise);
}

.btn.primary {
  background: var(--ac);
  border-color: var(--ac);
  color: #141414;
  font-weight: 600;
}

.btn.ghost {
  border-color: transparent;
  color: var(--tx-mute);
}

.btn.tiny {
  padding: 5px 10px;
  font-size: 12px;
}
</style>
