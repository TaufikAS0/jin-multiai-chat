const express = require('express');
const { readMemory, writeMemory } = require('../db/memory');
const { saveSessionMd } = require('../db/obsidian');
const { buildContext } = require('../lib/context');
const { streamFromRouter } = require('../lib/router');

const router = express.Router();

function send(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

async function runOneModel(res, session, model, userMsg, priorResponses) {
  const messages = buildContext(session, model, userMsg, priorResponses);
  const start = Date.now();
  let fullContent = '';

  const response = await streamFromRouter(messages, model);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        const token = parsed.choices?.[0]?.delta?.content || '';
        if (token) {
          fullContent += token;
          send(res, { type: 'token', model, token, full: fullContent });
        }
      } catch {}
    }
  }

  const elapsed = +((Date.now() - start) / 1000).toFixed(1);
  return { content: fullContent, elapsed };
}

router.post('/sequential', async (req, res) => {
  const { sessionId, models, message } = req.body;
  if (!models?.length || !message) {
    return res.status(400).json({ error: 'models and message required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Load session
  const mem = readMemory();
  const session = sessionId ? mem.sessions.find(x => x.id === sessionId) : null;

  send(res, { type: 'turn_start', models, message });

  // Save user message immediately
  const userMsg = {
    id: Date.now().toString(),
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  };
  if (session) {
    session.messages.push(userMsg);
    session.updated = new Date().toISOString();
    writeMemory(mem);
  }

  const results = [];

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    send(res, { type: 'model_start', model, index: i, total: models.length });

    try {
      const { content, elapsed } = await runOneModel(res, session || { messages: [], systemPrompt: '' }, model, message, results);
      results.push({ model, content });
      send(res, { type: 'model_done', model, content, elapsed });

      // Save assistant message
      if (session) {
        const aiMsg = {
          id: Date.now().toString() + i,
          role: 'assistant',
          model,
          content,
          timestamp: new Date().toISOString(),
        };
        session.messages.push(aiMsg);
        session.updated = new Date().toISOString();
        writeMemory(mem);
      }
    } catch (e) {
      send(res, { type: 'error', model, message: e.message });
      results.push({ model, content: '', error: e.message });
    }
  }

  send(res, { type: 'turn_done', results });

  // Save Obsidian .md
  if (session) {
    try { saveSessionMd(session); } catch {}
  }

  res.end();
});

// POST /api/chat/compact — summarize session history, replace with compact block
router.post('/compact', async (req, res) => {
  const { sessionId, model } = req.body;
  if (!sessionId || !model) return res.status(400).json({ error: 'sessionId and model required' });

  const mem = readMemory();
  const session = mem.sessions.find(x => x.id === sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!session.messages.length) return res.status(400).json({ error: 'No messages to compact' });

  // Build full history as plain text for summarization
  const lines = [];
  for (const msg of session.messages) {
    if (msg.role === 'user') {
      lines.push(`User: ${msg.content}`);
    } else if (msg.role === 'assistant') {
      lines.push(`${msg.model}: ${msg.content}`);
    } else if (msg.role === 'compact') {
      lines.push(`[Ringkasan sebelumnya]: ${msg.content}`);
    }
  }

  const prompt = `Buat ringkasan padat dari percakapan berikut. Pertahankan semua informasi penting, keputusan, hasil, dan konteks yang dibutuhkan untuk melanjutkan percakapan. Tulis dalam bentuk paragraf ringkas.\n\n---\n${lines.join('\n\n')}\n---\n\nRingkasan:`;

  try {
    const response = await require('../lib/router').streamFromRouter(
      [{ role: 'user', content: prompt }],
      model
    );

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let summary = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines2 = buffer.split('\n');
      buffer = lines2.pop();
      for (const line of lines2) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          const token = parsed.choices?.[0]?.delta?.content || '';
          if (token) summary += token;
        } catch {}
      }
    }

    // Replace all messages with one compact block
    const compactMsg = {
      id: Date.now().toString(),
      role: 'compact',
      model,
      content: summary.trim(),
      timestamp: new Date().toISOString(),
      originalCount: session.messages.length,
    };
    session.messages = [compactMsg];
    session.updated = new Date().toISOString();
    writeMemory(mem);

    try { saveSessionMd(session); } catch {}

    res.json({ ok: true, summary: summary.trim(), originalCount: compactMsg.originalCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
