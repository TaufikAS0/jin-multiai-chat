import { state } from '../state.js';
import { escHtml } from '../utils.js';

export function renderSessions(container, onOpen, onDelete) {
  if (!state.sessions.length) {
    container.innerHTML = '<div class="loading-text">Belum ada session</div>';
    return;
  }
  container.innerHTML = state.sessions.map(s => {
    const active = s.id === state.activeSessionId ? 'active' : '';
    const date = new Date(s.updated).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    return `<div class="session-item ${active}" data-id="${s.id}">
      <div class="session-name">${escHtml(s.name)}</div>
      <div class="session-meta">${s.messageCount} pesan · ${date}</div>
      <button class="session-del" data-del="${s.id}" title="Hapus">✕</button>
    </div>`;
  }).join('');

  container.querySelectorAll('.session-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.dataset.del) return;
      onOpen(el.dataset.id);
    });
  });
  container.querySelectorAll('.session-del').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); onDelete(btn.dataset.del); });
  });
}
