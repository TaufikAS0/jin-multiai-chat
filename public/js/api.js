const base = '';

export async function getModels() {
  const r = await fetch(`${base}/api/models`);
  return r.json();
}

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

export function startSequentialStream(sessionId, models, message) {
  return fetch(`${base}/api/chat/sequential`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, models, message }),
  });
}
