const { ROUTER_BASE, ROUTER_KEY } = require('../config');

async function streamFromRouter(messages, model) {
  const response = await fetch(`${ROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Router error ${response.status}: ${text}`);
  }

  return response;
}

async function fetchModels() {
  const response = await fetch(`${ROUTER_BASE}/models`, {
    headers: { Authorization: `Bearer ${ROUTER_KEY}` },
  });
  if (!response.ok) throw new Error(`Router error ${response.status}`);
  return response.json();
}

module.exports = { streamFromRouter, fetchModels };
