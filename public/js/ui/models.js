import { state } from '../state.js';
import { escHtml } from '../utils.js';

export const PROVIDER_TIERS = {
  free: ['kr', 'oc', 'vertex'],
  sub:  ['cc', 'cx', 'cu', 'gh', 'ag'],
  paid: ['kimi', 'glm', 'minimax', 'openrouter', 'openai', 'anthropic', 'gemini', 'deepseek', 'groq', 'xai', 'mistral'],
};

export function getBadge(model) {
  const owner = model.owned_by || model.id.split('/')[0];
  if (PROVIDER_TIERS.free.includes(owner)) return { text: 'free', cls: 'badge-free' };
  if (PROVIDER_TIERS.sub.includes(owner))  return { text: 'sub',  cls: 'badge-sub' };
  if (PROVIDER_TIERS.paid.includes(owner)) return { text: 'paid', cls: 'badge-paid' };
  return { text: owner, cls: 'badge-paid' };
}

export function renderModels(container, onSelectionChange) {
  if (!state.models.length) {
    container.innerHTML = '<div class="loading-text" style="color:#f87171">9Router offline</div>';
    return;
  }

  const groups = {};
  for (const m of state.models) {
    const owner = m.owned_by || m.id.split('/')[0];
    if (!groups[owner]) groups[owner] = [];
    groups[owner].push(m);
  }

  let html = '';
  for (const [owner, models] of Object.entries(groups)) {
    const badge = getBadge(models[0]);
    html += `<div class="provider-group">
      <div class="provider-header">
        <span class="provider-name">${escHtml(owner)}</span>
        <span class="model-badge ${badge.cls}">${badge.text}</span>
      </div>`;
    for (const m of models) {
      const checked = state.selectedModels.has(m.id) ? 'checked' : '';
      const shortId = m.id.includes('/') ? m.id.split('/').slice(1).join('/') : m.id;
      html += `<label class="model-item">
        <input type="checkbox" data-model="${m.id}" ${checked} />
        <span class="model-label ${checked ? 'active' : ''}">${escHtml(shortId)}</span>
      </label>`;
    }
    html += `</div>`;
  }
  container.innerHTML = html;

  container.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.selectedModels.add(cb.dataset.model);
      else state.selectedModels.delete(cb.dataset.model);
      cb.closest('.model-item').querySelector('.model-label').classList.toggle('active', cb.checked);
      onSelectionChange();
    });
  });
}
