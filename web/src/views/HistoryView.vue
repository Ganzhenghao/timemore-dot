<script setup lang="ts">
/**
 * 历史冲煮记录：分页表格 + 详情（曲线 + 计划对比 + 评分备注编辑 + 删除）。
 * 表格遵循语义化 thead/th；删除需确认。
 */
import { computed, onMounted, ref } from 'vue'
import { api, type BrewRecordRow } from '../api/client'
import { useToastStore } from '../stores/toast'
import { usePlansStore } from '../stores/plans'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import BrewChart from '../components/BrewChart.vue'
import { formatClock, targetCurve } from '../core/planModel'
import type { SessionSample } from '../core/brewSession'

const toast = useToastStore()
const plans = usePlansStore()

const rows = ref<BrewRecordRow[]>([])
const total = ref(0)
const page = ref(1)
const size = 10
const loading = ref(false)

const detail = ref<{
  id: number
  samples: SessionSample[]
  steps: ReturnType<typeof targetCurve> | null
  planName: string | null
} | null>(null)
const detailRow = ref<BrewRecordRow | null>(null)
const ratingDraft = ref(0)
const notesDraft = ref('')
const deleteConfirm = ref(false)
const deletingId = ref<number | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size)))

async function load(): Promise<void> {
  loading.value = true
  try {
    const r = await api.recordPageQuery({ page: page.value, size })
    rows.value = r.list
    total.value = r.total
  } catch (e) {
    toast.push(`加载历史失败: ${(e as Error).message}`, 'err')
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function openDetail(row: BrewRecordRow): Promise<void> {
  try {
    const d = await api.recordGetById(row.id)
    const samples: SessionSample[] = d.samples
      ? d.samples.t.map((t, i) => ({ t, w: d.samples!.w[i]! / 10, f: d.samples!.f[i]! / 10 }))
      : []
    const plan = d.planId != null ? plans.list.find((p) => p.id === d.planId) : null
    detail.value = {
      id: d.id,
      samples,
      steps: plan ? targetCurve(plan.steps) : null,
      planName: plan?.name ?? null,
    }
    detailRow.value = d
    ratingDraft.value = d.rating ?? 0
    notesDraft.value = d.notes ?? ''
  } catch (e) {
    toast.push(`加载详情失败: ${(e as Error).message}`, 'err')
  }
}

async function savePatch(): Promise<void> {
  if (!detailRow.value) return
  try {
    await api.recordUpdate(detailRow.value.id, { rating: ratingDraft.value || null, notes: notesDraft.value })
    toast.push('已保存', 'ok')
    await load()
  } catch (e) {
    toast.push(`保存失败: ${(e as Error).message}`, 'err')
  }
}

async function confirmDelete(): Promise<void> {
  if (deletingId.value == null) return
  await api.recordDelete(deletingId.value)
  if (detailRow.value?.id === deletingId.value) {
    detail.value = null
    detailRow.value = null
  }
  deletingId.value = null
  toast.push('记录已删除', 'info')
  await load()
}

function fmtDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function fmtDuration(ms: number | null): string {
  return ms != null ? formatClock(ms / 1000) : '—'
}

const detailStepsForChart = computed(() => {
  if (!detailRow.value?.planId) return null
  const plan = plans.list.find((p) => p.id === detailRow.value?.planId)
  return plan?.steps ?? null
})
</script>

<template>
  <div class="history">
    <header class="page-head">
      <h1>历史冲煮记录</h1>
      <span class="total num">{{ total }} 条</span>
    </header>

    <div v-if="rows.length === 0 && !loading" class="empty">还没有冲煮记录</div>

    <table v-else class="table">
      <thead>
        <tr>
          <th>时间</th>
          <th>时长</th>
          <th>粉量</th>
          <th>总水量</th>
          <th>峰值流速</th>
          <th>计划</th>
          <th>评分</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="r in rows"
          :key="r.id"
          :class="{ active: detailRow?.id === r.id }"
          @click="openDetail(r)"
        >
          <td class="num">{{ fmtDate(r.startedAt) }}</td>
          <td class="num">{{ fmtDuration(r.durationMs) }}</td>
          <td class="num">{{ r.coffeeWeight ?? '—' }}</td>
          <td class="num">{{ r.waterTotal != null ? r.waterTotal.toFixed(1) : '—' }}</td>
          <td class="num">{{ r.peakFlow != null ? r.peakFlow.toFixed(1) + ' g/s' : '—' }}</td>
          <td>{{ (plans.list.find((p) => p.id === r.planId)?.name) ?? '—' }}</td>
          <td class="num">{{ r.rating ? '★'.repeat(r.rating) : '—' }}</td>
        </tr>
      </tbody>
    </table>

    <div class="pager">
      <button class="btn tiny" :disabled="page <= 1" @click="page--; load()">上一页</button>
      <span class="num">{{ page }} / {{ totalPages }}</span>
      <button class="btn tiny" :disabled="page >= totalPages" @click="page++; load()">下一页</button>
    </div>

    <!-- 详情 -->
    <section v-if="detail && detailRow" class="detail" aria-label="记录详情">
      <div class="detail-head">
        <h2>{{ fmtDate(detailRow.startedAt) }}</h2>
        <button class="btn tiny danger" @click="deletingId = detailRow.id; deleteConfirm = true">删除记录</button>
      </div>
      <BrewChart :samples="detail.samples" :target-curve="detail.steps" :steps="detailStepsForChart" :height="260" />

      <div class="detail-grid">
        <div class="d-item"><span>时长</span><b class="num">{{ fmtDuration(detailRow.durationMs) }}</b></div>
        <div class="d-item"><span>粉量</span><b class="num">{{ detailRow.coffeeWeight ?? '—' }} g</b></div>
        <div class="d-item"><span>总水量</span><b class="num">{{ detailRow.waterTotal ?? '—' }} g</b></div>
        <div class="d-item"><span>峰值流速</span><b class="num">{{ detailRow.peakFlow ?? '—' }} g/s</b></div>
        <div class="d-item"><span>平均流速</span><b class="num">{{ detailRow.avgFlow ?? '—' }} g/s</b></div>
        <div class="d-item"><span>计划</span><b>{{ detail.planName ?? '—' }}</b></div>
      </div>

      <div class="detail-notes">
        <label for="detail-rating">评分</label>
        <select id="detail-rating" v-model.number="ratingDraft">
          <option :value="0">未评分</option>
          <option v-for="n in 5" :key="n" :value="n">{{ '★'.repeat(n) }}</option>
        </select>
        <label for="detail-notes">备注</label>
        <textarea id="detail-notes" v-model="notesDraft" rows="2" maxlength="2000"></textarea>
        <button class="btn primary tiny" @click="savePatch()">保存</button>
      </div>
    </section>

    <ConfirmDialog
      v-model:open="deleteConfirm"
      title="删除冲煮记录？"
      message="删除后不可恢复。"
      confirm-text="删除"
      danger
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.history {
  padding: 24px 32px;
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-head h1 {
  font-size: 20px;
  font-weight: 400;
}

.total {
  color: var(--tx-mute);
  font-size: 13px;
}

.empty {
  text-align: center;
  color: var(--tx-mute);
  padding: 60px 0;
}

.table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--bd);
  border-radius: 6px;
  overflow: hidden;
}

.table th {
  text-align: left;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--tx-mute);
  text-transform: uppercase;
  background: var(--bg-soft);
  padding: 10px 14px;
  font-weight: 400;
}

.table td {
  padding: 10px 14px;
  font-size: 13px;
  border-top: 1px solid var(--bd);
  color: var(--tx);
}

.table tbody tr {
  cursor: pointer;
}

.table tbody tr:hover {
  background: var(--bg-soft);
}

.table tbody tr.active {
  background: rgba(200, 169, 110, 0.08);
}

.pager {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: center;
  color: var(--tx-mute);
  font-size: 12px;
}

.detail {
  border: 1px solid var(--bd);
  border-radius: 6px;
  background: var(--bg-soft);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-head h2 {
  font-size: 15px;
  font-weight: 400;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1px;
  background: var(--bd);
  border: 1px solid var(--bd);
  border-radius: 4px;
  overflow: hidden;
}

.d-item {
  background: var(--bg);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.d-item span {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: var(--tx-mute);
  text-transform: uppercase;
}

.d-item b {
  font-size: 14px;
  font-weight: 500;
}

.detail-notes {
  display: grid;
  grid-template-columns: auto 100px auto 1fr auto;
  gap: 10px;
  align-items: center;
}

.detail-notes label {
  font-size: 12px;
  color: var(--tx-mute);
}

.detail-notes select,
.detail-notes textarea {
  background: var(--bg-raise);
  border: 1px solid var(--bd-strong);
  border-radius: 4px;
  color: var(--tx);
  padding: 8px 10px;
  font-size: 13px;
}

.detail-notes textarea {
  resize: vertical;
}

.btn {
  padding: 9px 16px;
  border-radius: 4px;
  border: 1px solid var(--bd-strong);
  background: var(--bg-soft);
  color: var(--tx);
  font-size: 13px;
  cursor: pointer;
}

.btn.primary {
  background: var(--ac);
  border-color: var(--ac);
  color: #141414;
  font-weight: 600;
}

.btn.tiny {
  padding: 5px 10px;
  font-size: 12px;
}

.btn.danger {
  color: var(--err);
  border-color: rgba(224, 85, 85, 0.4);
}

.btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
