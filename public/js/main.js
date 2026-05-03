import { state } from './state.js';
import * as api from './api.js';
import { renderModels } from './ui/models.js';
import { renderSessions } from './ui/sessions.js';
import { renderChat, buildTurnEl, buildCompactBlock } from './ui/chat.js';
import { updateFooter } from './ui/footer.js';
import { initModal, openModal } from './ui/modal.js';
import { runSequentialStream } from './stream.js';
import { autoResize } from './utils.js';
import { initModeSwitch } from './ui/modeSwitch.js';
import { renderPlanPreview, clearPlanPreview } from './agent/planView.js';
import { startPipelineStream, stopPipelineStream } from './agent/pipeline.js';
import { renderFileTree } from './agent/fileTree.js';
import { logConsole } from './agent/console.js';

// DOM refs
const modelList      = document.getElementById('model-list');
const sessionList    = document.getElementById('session-list');
const chatBody       = document.getElementById('chat-body');
const chatTitle      = document.getElementById('chat-title');
const chatFooter     = document.getElementById('chat-footer');
const selectedBar    = document.getElementById('selected-models-bar');
const inputMsg       = document.getElementById('input-msg');
const btnSend        = document.getElementById('btn-send');
const btnStop        = document.getElementById('btn-stop');
const modelCount     = document.getElementById('model-count');
const emptyState     = document.getElementById('empty-state');
const btnNewSession  = document.getElementById('btn-new-session');
const btnStart       = document.getElementById('btn-start');
const btnClear       = document.getElementById('btn-clear-chat');
const btnSettings    = document.getElementById('btn-session-settings');
const modal          = document.getElementById('modal-settings');
const settingsName   = document.getElementById('settings-name');
const settingsSystem = document.getElementById('settings-system');
const btnCancel      = document.getElementById('btn-settings-cancel');
const btnSaveModal   = document.getElementById('btn-settings-save');

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([loadModels(), loadSessions()]);
}

async function loadModels() {
  try {
    const data = await api.getModels();
    state.models = (data.data || []).filter(m => m.id && m.owned_by);
    renderModels(modelList, onModelSelectionChange);
  } catch {
    modelList.innerHTML = '<div class="loading-text" style="color:#f87171">9Router offline</div>';
  }
}

async function loadSessions() {
  state.sessions = await api.getSessions();
  renderSessions(sessionList, openSession, onDeleteSession);
}

// ── Model selection ───────────────────────────────────────────────────────────
function onModelSelectionChange() {
  updateFooter(selectedBar, modelCount);
  if (state.activeSessionId) {
    api.updateSession(state.activeSessionId, { models: [...state.selectedModels] });
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────
async function openSession(id) {
  state.activeSessionId = id;
  const session = await api.getSession(id);
  state.selectedModels = new Set(session.models || []);
  renderModels(modelList, onModelSelectionChange);
  updateFooter(selectedBar, modelCount);

  chatTitle.textContent = session.name;
  btnClear.style.display = '';
  btnSettings.style.display = '';
  chatFooter.style.display = '';
  emptyState.style.display = 'none';

  renderChat(chatBody, session.messages);
  chatBody.scrollTop = chatBody.scrollHeight;
  renderSessions(sessionList, openSession, onDeleteSession);
}

async function createSession() {
  const session = await api.createSession({
    name: `Session ${state.sessions.length + 1}`,
    models: [...state.selectedModels],
  });
  await loadSessions();
  openSession(session.id);
}

async function onDeleteSession(id) {
  if (!confirm('Hapus session ini?')) return;
  await api.deleteSession(id);
  if (state.activeSessionId === id) {
    state.activeSessionId = null;
    chatTitle.textContent = 'Pilih atau buat session';
    btnClear.style.display = 'none';
    btnSettings.style.display = 'none';
    chatFooter.style.display = 'none';
    chatBody.innerHTML = '';
    emptyState.style.display = '';
    chatBody.appendChild(emptyState);
  }
  await loadSessions();
}

// ── Send ──────────────────────────────────────────────────────────────────────
async function compactSession() {
  if (!state.activeSessionId) return;
  if (state.selectedModels.size === 0) { alert('Pilih minimal 1 model untuk meringkas.'); return; }

  const model = [...state.selectedModels][0];
  btnSend.disabled = true;
  inputMsg.value = '';

  const indicator = document.createElement('div');
  indicator.className = 'compact-loading';
  indicator.textContent = `⚡ Memadatkan dengan ${model}...`;
  chatBody.appendChild(indicator);
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const result = await api.compactSession(state.activeSessionId, model);
    indicator.remove();
    if (result.error) throw new Error(result.error);

    // Re-render chat with compact block
    chatBody.innerHTML = '';
    const compactMsg = { role: 'compact', model, content: result.summary, timestamp: new Date().toISOString(), originalCount: result.originalCount };
    chatBody.appendChild(buildCompactBlock(compactMsg));
    loadSessions();
  } catch (e) {
    indicator.textContent = `Error: ${e.message}`;
    indicator.style.color = 'var(--red)';
  }
  btnSend.disabled = false;
}

async function sendMessage() {
  const text = inputMsg.value.trim();
  if (!text || state.streaming) return;
  if (!state.activeSessionId) { alert('Buat atau pilih session dulu.'); return; }

  if (text === '/compact') {
    inputMsg.value = '';
    autoResize(inputMsg);
    await compactSession();
    return;
  }

  if (state.selectedModels.size === 0) { alert('Pilih minimal 1 model.'); return; }

  inputMsg.value = '';
  autoResize(inputMsg);
  setStreaming(true);

  const models = [...state.selectedModels];
  state.abortController = new AbortController();

  const userMsg = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date().toISOString() };
  const turnEl = buildTurnEl(userMsg, []);
  chatBody.appendChild(turnEl);
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    await runSequentialStream({
      sessionId: state.activeSessionId,
      models,
      message: text,
      chatBody,
      turnEl,
      signal: state.abortController.signal,
      onTurnDone: () => loadSessions(),
    });
  } catch (e) {
    if (e.name !== 'AbortError') {
      const errDiv = document.createElement('div');
      errDiv.className = 'error-text';
      errDiv.textContent = `Error: ${e.message}`;
      chatBody.appendChild(errDiv);
    }
  }

  state.abortController = null;
  setStreaming(false);
  loadSessions();
}

function setStreaming(on) {
  state.streaming = on;
  btnSend.style.display = on ? 'none' : '';
  btnStop.style.display = on ? '' : 'none';
}

// ── Event Listeners ───────────────────────────────────────────────────────────
btnNewSession.addEventListener('click', createSession);
btnStart.addEventListener('click', createSession);
btnSend.addEventListener('click', sendMessage);

inputMsg.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
inputMsg.addEventListener('input', () => autoResize(inputMsg));

btnStop.addEventListener('click', () => {
  if (state.abortController) state.abortController.abort();
});

btnClear.addEventListener('click', async () => {
  if (!state.activeSessionId || !confirm('Hapus semua pesan?')) return;
  await api.clearMessages(state.activeSessionId);
  chatBody.innerHTML = '';
  loadSessions();
});

btnSettings.addEventListener('click', async () => {
  const session = await api.getSession(state.activeSessionId);
  openModal(modal, settingsName, settingsSystem, session);
});

initModal(modal, settingsName, settingsSystem, btnCancel, btnSaveModal, async ({ name, systemPrompt }) => {
  await api.updateSession(state.activeSessionId, { name, systemPrompt });
  chatTitle.textContent = name;
  loadSessions();
});

// ── Agent Mode ────────────────────────────────────────────────────────────────
initModeSwitch();

const btnPlan = document.getElementById('btn-plan');
const btnRun = document.getElementById('btn-run-workflow');
const btnRegen = document.getElementById('btn-regen-plan');

btnPlan?.addEventListener('click', async () => {
  const goal = document.getElementById('agent-goal').value.trim();
  if (!goal) return alert('Masukkan goal terlebih dahulu.');
  if (!state.plannerModel) return alert('Pilih planner model.');
  if (state.activeAgents.size === 0) return alert('Pilih minimal 1 agent aktif.');
  btnPlan.disabled = true;
  btnPlan.textContent = 'Merencanakan...';
  try {
    const result = await api.planWorkflow(goal, state.plannerModel, [...state.activeAgents]);
    if (result.error) throw new Error(result.error);
    state.currentWorkflow = result;
    renderPlanPreview(result);
  } catch (e) {
    alert('Gagal membuat rencana: ' + e.message);
  } finally {
    btnPlan.disabled = false;
    btnPlan.textContent = 'Buat Rencana';
  }
});

btnRun?.addEventListener('click', async () => {
  if (!state.currentWorkflow) return;
  try {
    await api.runWorkflow(state.currentWorkflow.workflowId);
    startPipelineStream(state.currentWorkflow.workflowId);
    renderFileTree(state.currentWorkflow.workflowId);
  } catch (e) {
    alert('Gagal menjalankan workflow: ' + e.message);
  }
});

btnRegen?.addEventListener('click', () => {
  clearPlanPreview();
  state.currentWorkflow = null;
});

// ── Start ─────────────────────────────────────────────────────────────────────
init();
