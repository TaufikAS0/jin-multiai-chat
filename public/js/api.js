const base = '';

// ── Models ───────────────────────────────────────────────────────────────────
export async function getModels() {
  const r = await fetch(`${base}/api/models`);
  return r.json();
}

// ── Sessions ─────────────────────────────────────────────────────────────────
export async function getSessions() {
  const r = await fetch(`${base}/api/sessions`);
  return r.json();
}

export async function getSession(id) {
  const r = await fetch(`${base}/api/sessions/${id}`);
  return r.json();
}

export async function createSession(data) {
  const r = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function updateSession(id, data) {
  const r = await fetch(`${base}/api/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function deleteSession(id) {
  await fetch(`${base}/api/sessions/${id}`, { method: 'DELETE' });
}

export async function clearMessages(id) {
  await fetch(`${base}/api/sessions/${id}/messages`, { method: 'DELETE' });
}

export async function compactSession(sessionId, model) {
  const r = await fetch(`${base}/api/chat/compact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, model }),
  });
  return r.json();
}

export function startSequentialStream(sessionId, models, message, signal) {
  return fetch(`${base}/api/chat/sequential`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, models, message }),
    signal,
  });
}

// ── Agent / Workflow ─────────────────────────────────────────────────────────
export async function planWorkflow(goal, plannerModel, availableAgents) {
  const r = await fetch(`${base}/api/agent/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, plannerModel, availableAgents }),
  });
  return r.json();
}

export async function runWorkflow(workflowId) {
  const r = await fetch(`${base}/api/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflowId }),
  });
  return r.json();
}

export function streamWorkflow(workflowId) {
  return new EventSource(`${base}/api/agent/stream/${workflowId}`);
}

export async function approveCommand(workflowId, taskId, approved, answer) {
  const r = await fetch(`${base}/api/agent/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflowId, taskId, approved, answer }),
  });
  return r.json();
}

export async function getWorkflows() {
  const r = await fetch(`${base}/api/agent/workflows`);
  return r.json();
}

export async function getWorkspaceFiles(workflowId) {
  const r = await fetch(`${base}/api/agent/workspaces/${workflowId}/files`);
  return r.json();
}

export async function getWorkspaceFile(workflowId, filePath) {
  const r = await fetch(`${base}/api/agent/workspaces/${workflowId}/files/${filePath}`);
  return r.json();
}
