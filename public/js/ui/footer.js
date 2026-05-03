import { state } from '../state.js';
import { escHtml } from '../utils.js';

export function updateFooter(container, countEl) {
  const count = state.selectedModels.size;
  countEl.textContent = `${count} model dipilih`;
  container.innerHTML = [...state.selectedModels].map(m =>
    `<span class="selected-tag"><span class="tag-dot"></span>${escHtml(m)}</span>`
  ).join('');
}
