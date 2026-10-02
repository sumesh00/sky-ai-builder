const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(
  /\/$/,
  '',
)

export function getProjectExportUrl(projectId) {
  return `${API_BASE_URL}/api/projects/${projectId}/export`
}

async function apiRequest(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, options)
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      body.error?.message ||
        body.message ||
        `API request failed with status ${response.status}`,
    )
  }

  return body
}

export async function getHealth() {
  return apiRequest('/api/health')
}

export async function getAIStatus() {
  const response = await apiRequest('/api/ai/status')

  return response.data
}

export async function sendAIMessage(message) {
  const response = await apiRequest('/api/ai/message', {
    body: JSON.stringify({ message }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.data
}

export async function createAIPlan(request, previousPlan, figmaUrl) {
  const response = await apiRequest('/api/ai/plan', {
    body: JSON.stringify({
      figmaUrl: figmaUrl || undefined,
      previousPlanId: previousPlan?.planId,
      previousPlanVersion: previousPlan?.version,
      request,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.data
}

export async function approveAIPlan(planId, version) {
  const response = await apiRequest(`/api/ai/plans/${planId}/approve`, {
    body: JSON.stringify({ version }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.data
}

export async function createProject(name, planId, planVersion) {
  const response = await apiRequest('/api/projects', {
    body: JSON.stringify({ name, planId, planVersion }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.data
}

export async function getProjects() {
  const response = await apiRequest('/api/projects')

  return response.data
}

export async function editProject(projectId, request) {
  const response = await apiRequest(`/api/projects/${projectId}/edits`, {
    body: JSON.stringify({ request }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.data
}

export async function auditProjectResponsiveness(projectId) {
  const response = await apiRequest(
    `/api/projects/${projectId}/responsive-audit`,
    {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )

  return response.data
}

export async function runProjectVisualCheck(projectId) {
  const response = await apiRequest(`/api/projects/${projectId}/visual-checks`, {
    body: JSON.stringify({}),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.data
}

export async function getProjectVersions(projectId) {
  const response = await apiRequest(`/api/projects/${projectId}/versions`)
  return response.data
}

export async function createProjectSnapshot(projectId, message) {
  const response = await apiRequest(`/api/projects/${projectId}/versions`, {
    body: JSON.stringify({ message }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  return response.data
}

export async function getProjectVersionDiff(projectId, revision) {
  const response = await apiRequest(`/api/projects/${projectId}/versions/${revision}/diff`)
  return response.data
}

export async function restoreProjectVersion(projectId, revision) {
  const response = await apiRequest(`/api/projects/${projectId}/versions/${revision}/restore`, {
    body: JSON.stringify({ confirmed: true }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  return response.data
}

export async function getReferenceImages(projectId) {
  const response = await apiRequest(`/api/projects/${projectId}/reference-images`)

  return response.data
}

export function getReferenceImageUrl(projectId, referenceId) {
  return `${API_BASE_URL}/api/projects/${projectId}/reference-images/${referenceId}`
}

export async function uploadReferenceImage(projectId, file) {
  const response = await apiRequest(`/api/projects/${projectId}/reference-images`, {
    body: await file.arrayBuffer(),
    headers: {
      'Content-Type': file.type,
      'X-Reference-Name': file.name,
    },
    method: 'POST',
  })

  return response.data
}

export async function getProjectCommands(projectId) {
  const response = await apiRequest(`/api/projects/${projectId}/commands`)

  return response.data
}

export async function runProjectCommand(projectId, action) {
  const response = await apiRequest(`/api/projects/${projectId}/commands`, {
    body: JSON.stringify({ action, confirmed: true }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.data
}

export async function getProjectPreview(projectId) {
  const response = await apiRequest(`/api/projects/${projectId}/preview`)

  return response.data
}

export async function startProjectPreview(projectId) {
  const response = await apiRequest(`/api/projects/${projectId}/preview/start`, {
    body: JSON.stringify({ confirmed: true }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.data
}

export async function stopProjectPreview(projectId) {
  const response = await apiRequest(`/api/projects/${projectId}/preview/stop`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.data
}

export async function getWorkspaceStatus() {
  const response = await apiRequest('/api/workspace/status')

  return response.data
}

export async function listWorkspaceFiles(projectId, path = '.', depth = 4) {
  const response = await apiRequest('/api/workspace/tools/list-files', {
    body: JSON.stringify({ depth, path, projectId }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.data
}
