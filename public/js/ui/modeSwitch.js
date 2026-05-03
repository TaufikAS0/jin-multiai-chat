import { state } from '../state.js';

export function initModeSwitch() {
  const tabChat = document.getElementById('tab-chat');
  const tabAgent = document.getElementById('tab-agent');
  const chatSidebar = document.getElementById('chat-sidebar');
  const agentSidebar = document.getElementById('agent-sidebar');
  const chatMain = document.getElementById('chat-main');
  const agentMain = document.getElementById('agent-main');
  const btnNewSession = document.getElementById('btn-new-session');

  tabChat.addEventListener('click', () => {
    state.appMode = 'chat';
    tabChat.classList.add('active');
    tabAgent.classList.remove('active');
    chatSidebar.style.display = '';
    agentSidebar.style.display = 'none';
    chatMain.style.display = '';
    agentMain.style.display = 'none';
    if (btnNewSession) btnNewSession.style.display = '';
  });

  tabAgent.addEventListener('click', () => {
    state.appMode = 'agent';
    tabAgent.classList.add('active');
    tabChat.classList.remove('active');
    chatSidebar.style.display = 'none';
    agentSidebar.style.display = '';
    chatMain.style.display = 'none';
    agentMain.style.display = '';
    if (btnNewSession) btnNewSession.style.display = 'none';
    populateAgentSelectors();
  });
}

function populateAgentSelectors() {
  const plannerSelect = document.getElementById('planner-select');
  const agentList = document.getElementById('agent-list');

  if (!plannerSelect || !agentList) return;

  plannerSelect.innerHTML = '<option value="">Pilih model planner...</option>';
  for (const m of state.models) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.id;
    plannerSelect.appendChild(opt);
  }
  if (state.plannerModel) plannerSelect.value = state.plannerModel;
  plannerSelect.onchange = () => { state.plannerModel = plannerSelect.value; };

  if (!state.models.length) {
    agentList.innerHTML = '<div class="loading-text" style="color:#f87171">9Router offline</div>';
    return;
  }

  const groups = {};
  for (const m of state.models) {
    const owner = m.owned_by || m.id.split('/')[0];
    if (!groups[owner]) groups[owner] = [];
    groups[owner].push(m);
  }

  agentList.innerHTML = '';
  for (const [owner, models] of Object.entries(groups)) {
    const group = document.createElement('div');
    group.className = 'provider-group';
    const header = document.createElement('div');
    header.className = 'provider-header';
    header.innerHTML = `<span class="provider-name">${escape(owner)}</span>`;
    group.appendChild(header);

    for (const m of models) {
      const checked = state.activeAgents.has(m.id);
      const label = document.createElement('label');
      label.className = 'model-item';
      const shortId = m.id.includes('/') ? m.id.split('/').slice(1).join('/') : m.id;
      label.innerHTML = `<input type="checkbox" data-agent="${escape(m.id)}" ${checked ? 'checked' : ''} /><span class="model-label ${checked ? 'active' : ''}">${escape(shortId)}</span>`;
      group.appendChild(label);
    }
    agentList.appendChild(group);
  }

  agentList.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.activeAgents.add(cb.dataset.agent);
      else state.activeAgents.delete(cb.dataset.agent);
      cb.closest('.model-item').querySelector('.model-label').classList.toggle('active', cb.checked);
    });
  });
}

function escape(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
