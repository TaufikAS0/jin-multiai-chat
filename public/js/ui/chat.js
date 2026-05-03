import { renderMarkdown, escHtml } from '../utils.js';

export function renderChat(container, messages) {
  container.innerHTML = '';
  if (!messages.length) return;

  const turns = [];
  let current = null;
  for (const msg of messages) {
    if (msg.role === 'user') {
      current = { user: msg, responses: [] };
      turns.push(current);
    } else if (msg.role === 'assistant' && current) {
      current.responses.push(msg);
    }
  }
  for (const t of turns) container.appendChild(buildTurnEl(t.user, t.responses));
}

export function buildTurnEl(userMsg, responses = []) {
  const turn = document.createElement('div');
  turn.className = 'turn';
  turn.dataset.msgId = userMsg.id;

  const bubble = document.createElement('div');
  bubble.className = 'user-bubble';
  bubble.textContent = userMsg.content;
  turn.appendChild(bubble);

  const stack = document.createElement('div');
  stack.className = 'ai-stack';

  responses.forEach((r, i) => {
    if (i > 0) stack.appendChild(buildHandoverBar(responses[i - 1].model, r.model));
    stack.appendChild(buildAiCard(r.model, r.content, 'done'));
  });

  if (stack.children.length) turn.appendChild(stack);
  return turn;
}

export function buildAiCard(modelId, content, state = 'queued') {
  const card = document.createElement('div');
  card.className = `ai-card ${state}`;
  card.dataset.model = modelId;

  const header = document.createElement('div');
  header.className = 'ai-card-header';
  header.innerHTML = `
    <div class="ai-dot"></div>
    <div class="ai-name">${escHtml(modelId)}</div>
    <div class="ai-status">${stateLabel(state)}</div>`;
  card.appendChild(header);

  const body = document.createElement('div');
  body.className = 'ai-card-body';
  if (content) {
    body.innerHTML = renderMarkdown(content);
  } else {
    body.innerHTML = '<span class="waiting-text">menunggu...</span>';
  }
  card.appendChild(body);
  return card;
}

export function buildHandoverBar(fromModel, toModel) {
  const bar = document.createElement('div');
  bar.className = 'handover-bar';
  bar.innerHTML = `<span>↓ context dari <strong>${escHtml(fromModel)}</strong> diteruskan ke <strong>${escHtml(toModel)}</strong></span>`;
  return bar;
}

function stateLabel(s) {
  if (s === 'queued') return 'menunggu';
  if (s === 'active') return 'berpikir...';
  if (s === 'done')   return '';
  if (s === 'error')  return 'gagal';
  return '';
}

export function setCardState(card, newState, statusText = '') {
  card.className = `ai-card ${newState}`;
  const dot = card.querySelector('.ai-dot');
  const status = card.querySelector('.ai-status');
  if (dot) dot.className = `ai-dot ${newState}`;
  if (status) status.textContent = statusText || stateLabel(newState);
}

export function setCardContent(card, html, appendCursor = false) {
  const body = card.querySelector('.ai-card-body');
  if (!body) return;
  body.innerHTML = html + (appendCursor ? '<span class="cursor"></span>' : '');
}
