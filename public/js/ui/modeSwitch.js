import { state } from '../state.js';
import { renderModelChecklist } from './models.js';

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

export function populateAgentSelectors() {
  const plannerSelect = document.getElementById('planner-select');
  const agentList = document.getElementById('agent-list');

  if (!plannerSelect || !agentList) return;

  // Planner dropdown
  plannerSelect.innerHTML = '<option value="">Pilih model planner...</option>';
  for (const m of state.models) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.id;
    plannerSelect.appendChild(opt);
  }
  if (state.plannerModel) plannerSelect.value = state.plannerModel;
  plannerSelect.onchange = () => { state.plannerModel = plannerSelect.value; };

  // Agent checklist — use the SAME renderer as Chat Mode to guarantee identical behavior
  renderModelChecklist(agentList, state.activeAgents, null, 'data-agent');
}
