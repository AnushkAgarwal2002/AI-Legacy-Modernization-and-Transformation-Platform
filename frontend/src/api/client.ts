import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000,
})

export default api

// ─── Projects ────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () => api.get('/projects').then(r => r.data),
  get: (id: string) => api.get(`/projects/${id}`).then(r => r.data),
  create: (data: any) => api.post('/projects', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/projects/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`).then(r => r.data),
  dashboard: (id: string) => api.get(`/projects/${id}/dashboard`).then(r => r.data),
}

// ─── Files ───────────────────────────────────────────────────────────────────
export const filesApi = {
  list: (projectId: string) => api.get(`/projects/${projectId}/files`).then(r => r.data),
  get: (projectId: string, fileId: string) => api.get(`/projects/${projectId}/files/${fileId}`).then(r => r.data),
  uploadFiles: (projectId: string, files: File[], replace?: boolean) => {
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    fd.append('replace', replace ? 'true' : 'false')
    return api.post(`/projects/${projectId}/files/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  },
  uploadZip: (projectId: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('replace', 'true')
    return api.post(`/projects/${projectId}/files/upload-zip`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  },
  loadDemo: (projectId: string) => api.post(`/projects/${projectId}/files/upload-demo`).then(r => r.data),
}

// ─── Analysis ────────────────────────────────────────────────────────────────
export const analysisApi = {
  start: (projectId: string, force?: boolean) =>
    api.post(`/projects/${projectId}/analysis/start`, { force_reanalyze: !!force }).then(r => r.data),
  status: (projectId: string) => api.get(`/projects/${projectId}/analysis/status`).then(r => r.data),
  get: (projectId: string) => api.get(`/projects/${projectId}/analysis`).then(r => r.data),
  issues: (projectId: string) => api.get(`/projects/${projectId}/analysis/issues`).then(r => r.data),
  updateIssue: (projectId: string, issueId: string, data: any) =>
    api.patch(`/projects/${projectId}/analysis/issues/${issueId}`, data).then(r => r.data),
  recommendations: (projectId: string) =>
    api.get(`/projects/${projectId}/analysis/recommendations`).then(r => r.data),
  architecture: (projectId: string) =>
    api.get(`/projects/${projectId}/analysis/architecture`).then(r => r.data),
  plan: (projectId: string) => api.get(`/projects/${projectId}/analysis/plan`).then(r => r.data),
  updateTask: (projectId: string, taskId: string, data: any) =>
    api.patch(`/projects/${projectId}/analysis/plan/tasks/${taskId}`, data).then(r => r.data),
}

// ─── Transformations ─────────────────────────────────────────────────────────
export const transformationsApi = {
  create: (projectId: string, data: any) =>
    api.post(`/projects/${projectId}/transformations`, data).then(r => r.data),
  list: (projectId: string) =>
    api.get(`/projects/${projectId}/transformations`).then(r => r.data),
  get: (projectId: string, id: string) =>
    api.get(`/projects/${projectId}/transformations/${id}`).then(r => r.data),
  updateStatus: (projectId: string, id: string, status: string) =>
    api.patch(`/projects/${projectId}/transformations/${id}`, { status }).then(r => r.data),
  validate: (projectId: string, id: string) =>
    api.post(`/projects/${projectId}/transformations/${id}/validate`).then(r => r.data),
  validations: (projectId: string) =>
    api.get(`/projects/${projectId}/transformations/validation/all`).then(r => r.data),
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const chatApi = {
  send: (projectId: string, message: string, contextFile?: string, contextType?: string) =>
    api.post(`/projects/${projectId}/chat`, { message, context_file: contextFile, context_type: contextType }).then(r => r.data),
  history: (projectId: string) => api.get(`/projects/${projectId}/chat/history`).then(r => r.data),
  clear: (projectId: string) => api.delete(`/projects/${projectId}/chat/history`).then(r => r.data),
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  generate: (projectId: string) => api.post(`/projects/${projectId}/report`).then(r => r.data),
}
