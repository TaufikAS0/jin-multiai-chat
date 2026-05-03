const express = require('express');
const { readMemory, writeMemory } = require('../db/memory');

const router = express.Router();

router.get('/', (req, res) => {
  const mem = readMemory();
  res.json(mem.sessions.map(s => ({
    id: s.id, name: s.name, updated: s.updated,
    models: s.models || [], messageCount: s.messages?.length || 0,
  })));
});

router.post('/', (req, res) => {
  const mem = readMemory();
  const session = {
    id: Date.now().toString(),
    name: req.body.name || `Session ${mem.sessions.length + 1}`,
    systemPrompt: req.body.systemPrompt || '',
    models: req.body.models || [],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    messages: [],
  };
  mem.sessions.unshift(session);
  writeMemory(mem);
  res.json(session);
});

router.get('/:id', (req, res) => {
  const s = readMemory().sessions.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

router.patch('/:id', (req, res) => {
  const mem = readMemory();
  const s = mem.sessions.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (req.body.name !== undefined) s.name = req.body.name;
  if (req.body.models !== undefined) s.models = req.body.models;
  if (req.body.systemPrompt !== undefined) s.systemPrompt = req.body.systemPrompt;
  s.updated = new Date().toISOString();
  writeMemory(mem);
  res.json(s);
});

router.delete('/:id', (req, res) => {
  const mem = readMemory();
  mem.sessions = mem.sessions.filter(x => x.id !== req.params.id);
  writeMemory(mem);
  res.json({ ok: true });
});

router.post('/:id/messages', (req, res) => {
  const mem = readMemory();
  const s = mem.sessions.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  s.messages.push(req.body);
  s.updated = new Date().toISOString();
  writeMemory(mem);
  res.json({ ok: true });
});

router.delete('/:id/messages', (req, res) => {
  const mem = readMemory();
  const s = mem.sessions.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  s.messages = [];
  s.updated = new Date().toISOString();
  writeMemory(mem);
  res.json({ ok: true });
});

module.exports = router;
