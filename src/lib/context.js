function buildContext(session, model, userMsg, priorResponses = []) {
  const messages = [];

  if (session.systemPrompt) {
    messages.push({ role: 'system', content: session.systemPrompt });
  }

  // History: user messages + this model's own past responses
  for (const msg of (session.messages || [])) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' && msg.model === model) {
      messages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Inject prior responses from THIS turn (context handover)
  if (priorResponses.length > 0) {
    const lines = priorResponses.map(r => `— ${r.model}:\n${r.content}`).join('\n\n');
    const handover = `Sebelum kamu menjawab, AI lain sudah memberikan respons untuk pertanyaan ini:\n\n${lines}\n\nKamu boleh membangun di atas, membandingkan, atau menambahkan perspektif baru.`;
    messages.push({ role: 'system', content: handover });
  }

  messages.push({ role: 'user', content: userMsg });
  return messages;
}

module.exports = { buildContext };
