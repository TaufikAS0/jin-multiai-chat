import { startSequentialStream } from './api.js';
import { state } from './state.js';
import { renderMarkdown, isNearBottom } from './utils.js';
import { buildAiCard, buildHandoverBar, setCardState, setCardContent } from './ui/chat.js';

export async function runSequentialStream({ sessionId, models, message, chatBody, turnEl, onModelDone, onTurnDone }) {
  const stack = turnEl.querySelector('.ai-stack');

  // Pre-build all cards in "queued" state
  const cards = {};
  models.forEach((model, i) => {
    if (i > 0) {
      stack.appendChild(buildHandoverBar(models[i - 1], model));
    }
    const card = buildAiCard(model, '', 'queued');
    cards[model] = card;
    stack.appendChild(card);
  });

  chatBody.scrollTop = chatBody.scrollHeight;

  const response = await startSequentialStream(sessionId, models, message);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(err);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let activeModel = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      let evt;
      try { evt = JSON.parse(raw); } catch { continue; }

      switch (evt.type) {
        case 'model_start': {
          activeModel = evt.model;
          const card = cards[activeModel];
          if (card) {
            setCardState(card, 'active');
            setCardContent(card, '', true);
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          break;
        }

        case 'token': {
          const card = cards[evt.model];
          if (card) {
            setCardContent(card, renderMarkdown(evt.full), true);
            if (isNearBottom(chatBody)) chatBody.scrollTop = chatBody.scrollHeight;
          }
          break;
        }

        case 'model_done': {
          const card = cards[evt.model];
          if (card) {
            setCardState(card, 'done', `${evt.elapsed}s`);
            setCardContent(card, renderMarkdown(evt.content), false);
          }
          if (onModelDone) onModelDone(evt.model, evt.content);
          break;
        }

        case 'error': {
          const card = cards[evt.model];
          if (card) {
            setCardState(card, 'error');
            setCardContent(card, `<span class="error-text">${evt.message}</span>`);
          }
          break;
        }

        case 'turn_done': {
          if (onTurnDone) onTurnDone(evt.results);
          break;
        }
      }
    }
  }
}
