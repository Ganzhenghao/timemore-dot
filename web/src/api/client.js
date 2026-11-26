/**
 * 后端 API 客户端：统一 { ok, data, error } 响应处理。
 */
class ApiError extends Error {
}
async function request(url, init) {
    const resp = await fetch(url, {
        headers: init?.body ? { 'content-type': 'application/json' } : undefined,
        ...init,
    });
    let body;
    try {
        body = await resp.json();
    }
    catch {
        throw new ApiError(`HTTP ${resp.status}`);
    }
    if (!body.ok)
        throw new ApiError(body.error ?? `HTTP ${resp.status}`);
    return body.data;
}
const post = (url, data) => request(url, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
export const api = {
    health: () => request('/api/health'),
    databaseCurrent: () => request('/api/database/current'),
    databaseTest: (cfg) => post('/api/database/test', cfg),
    databaseSave: (cfg) => post('/api/database/save', cfg),
    planList: () => request('/api/brewPlan/list'),
    planSave: (plan) => post('/api/brewPlan/save', plan),
    planDelete: (id) => post(`/api/brewPlan/delete/${id}`),
    recordPageQuery: (params) => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null)
                q.set(k, String(v));
        }
        return request(`/api/brewRecord/pageQuery?${q}`);
    },
    recordGetById: (id) => request(`/api/brewRecord/getById/${id}`),
    recordSave: (rec) => post('/api/brewRecord/save', rec),
    recordUpdate: (id, patch) => post(`/api/brewRecord/update/${id}`, patch),
    recordDelete: (id) => post(`/api/brewRecord/delete/${id}`),
};
