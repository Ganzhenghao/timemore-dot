/**
 * 后端 API 客户端：统一 { ok, data, error } 响应处理。
 */

class ApiError extends Error {}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(url, {
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  })
  let body: { ok?: boolean; data?: T; error?: string }
  try {
    body = await resp.json()
  } catch {
    throw new ApiError(`HTTP ${resp.status}`)
  }
  if (!body.ok) throw new ApiError(body.error ?? `HTTP ${resp.status}`)
  return body.data as T
}

const post = <T>(url: string, data?: unknown) =>
  request<T>(url, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) })

export interface DbConfigView {
  type: 'sqlite' | 'mysql'
  sqlite: { file: string }
  mysql?: { host: string; port: number; user: string; database: string }
  configFile: string
  envOverrides: string[]
}

export interface BrewRecordRow {
  id: number
  mode: string
  planId: number | null
  startedAt: number
  endedAt: number | null
  durationMs: number | null
  coffeeWeight: number | null
  waterTotal: number | null
  peakFlow: number | null
  avgFlow: number | null
  deviceName: string | null
  rating: number | null
  notes: string | null
}

export interface BrewRecordDetail extends BrewRecordRow {
  samples: { t: number[]; w: number[]; f: number[] } | null
}

export interface BrewPlanRow {
  id: number
  name: string
  coffeeWeight: number | null
  ratio: number | null
  steps: { type: 'pour' | 'pause'; label?: string; startS: number; endS: number; targetG?: number }[]
  createdAt: number
  updatedAt: number
}

export const api = {
  health: () => request<{ db: string }>('/api/health'),
  databaseCurrent: () => request<DbConfigView>('/api/database/current'),

  planList: () => request<BrewPlanRow[]>('/api/brewPlan/list'),
  planSave: (plan: unknown) => post<{ id: number }>('/api/brewPlan/save', plan),
  planDelete: (id: number) => post<Record<string, never>>(`/api/brewPlan/delete/${id}`),

  recordPageQuery: (params: { page?: number; size?: number; mode?: string; planId?: number }) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) q.set(k, String(v))
    }
    return request<{ total: number; page: number; size: number; list: BrewRecordRow[] }>(
      `/api/brewRecord/pageQuery?${q}`,
    )
  },
  recordGetById: (id: number) => request<BrewRecordDetail>(`/api/brewRecord/getById/${id}`),
  recordSave: (rec: unknown) => post<{ id: number }>('/api/brewRecord/save', rec),
  recordUpdate: (id: number, patch: { rating?: number | null; notes?: string }) =>
    post<Record<string, never>>(`/api/brewRecord/update/${id}`, patch),
  recordDelete: (id: number) => post<Record<string, never>>(`/api/brewRecord/delete/${id}`),
}
