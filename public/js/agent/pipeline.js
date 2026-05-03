import { state } from '../state.js';
import * as api from '../api.js';
import { renderFileTree } from './fileTree.js';
import { logConsole } from './console.js';

let currentEventSource = null;

export function startPipelineStream(workflowId) {
  stopPipelineStream();

  const board = document.getElementById('pipeline-board');
  if (board) board.innerHTML = '<div class="loading-text">Menghubungkan ke pipeline...</div>';

  const empty = document.getElementById('agent-empty');
  const plan = document.getElementById('plan-preview');
  const pipeline = document.getElementById('pipeline-view');
  if (empty) empty.style.display = 'none';
  if (plan) plan.style.display = 'none';
  if (pipeline) pipeline.style.display = '';

  const es = api.streamWorkflow(workflowId);
  currentEventSource = es;

  es.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data);
      handleEvent(workflowId, evt);
    } catch (err) {
      console.error('SSE parse error', err);
    }
  };

  es.onerror = () => {
    logConsole('system', 'Koneksi pipeline terputus.');
  };
}

export function stopPipelineStream() {
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }
}

function handleEvent(workflowId, evt) {
  const board = document.getElementById('pipeline-board');

  switch (evt.type) {
    case 'workflow_state':
      renderWorkflowState(board, evt.workflow);
      break;
    case 'workflow_start':
      logConsole('system', `Workflow dimulai (mode: ${evt.mode})`);
      break;
    case 'task_start':
      updateTaskCard(board, evt.taskId, 'running', evt.assignee);
      logConsole(evt.assignee, `Task ${evt.taskId} dimulai`);
      break;
    case 'task_tools':
      logConsole('system', `Task ${evt.taskId} memanggil ${evt.calls?.length || 0} tool(s)`);
      break;
    case 'tool_results':
      for (const r of evt.results || []) {
        if (r.error) logConsole('error', `[${r.tool}] ERROR: ${r.error}`);
        else logConsole('success', `[${r.tool}] OK`);
      }
      renderFileTree(workflowId);
      break;
    case 'task_done':
      updateTaskCard(board, evt.taskId, 'done');
      logConsole('success', `Task ${evt.taskId} selesai`);
      break;
    case 'task_failed':
      updateTaskCard(board, evt.taskId, 'failed', null, evt.error);
      logConsole('error', `Task ${evt.taskId} gagal: ${evt.error}`);
      break;
    case 'needs_approval':
      showApprovalModal(workflowId, evt.taskId, evt.command);
      break;
    case 'needs_input':
      showInputModal(workflowId, evt.taskId, evt.question);
      break;
    case 'workflow_done':
      logConsole('success', 'Workflow selesai!');
      renderFileTree(workflowId);
      break;
    case 'workflow_error':
      logConsole('error', `Workflow error: ${evt.error}`);
      break;
  }
}

function renderWorkflowState(board, workflow) {
  if (!board || !workflow || !workflow.tasks) return;
  board.innerHTML = '';
  workflow.tasks.forEach(t => board.appendChild(createTaskCard(t)));
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `pipeline-card ${task.status}`;
  card.dataset.taskId = task.id;
  card.innerHTML = `
    <div class="pipeline-card-header">
      <span class="pipeline-dot ${task.status}"></span>
      <span class="pipeline-name">${esc(task.id)}</span>
      <span class="pipeline-assignee">${esc(task.assignee)}</span>
      <span class="pipeline-status">${task.status}</span>
    </div>
    <div class="pipeline-card-body">${esc(task.description)}</div>
    ${task.result ? `<div class="pipeline-card-result">${esc(task.result.slice(0, 300))}</div>` : ''}
    ${task.error ? `<div class="pipeline-card-error">${esc(task.error)}</div>` : ''}
  `;
  return card;
}

function updateTaskCard(board, taskId, status, assignee, error) {
  if (!board) return;
  let card = board.querySelector(`[data-task-id="${taskId}"]`);
  if (!card) {
    card = document.createElement('div');
    card.className = `pipeline-card ${status}`;
    card.dataset.taskId = taskId;
    board.appendChild(card);
  }
  card.className = `pipeline-card ${status}`;
  const dot = card.querySelector('.pipeline-dot');
  if (dot) dot.className = `pipeline-dot ${status}`;
  const statusEl = card.querySelector('.pipeline-status');
  if (statusEl) statusEl.textContent = status;
  if (assignee) {
    let asg = card.querySelector('.pipeline-assignee');
    if (!asg) {
      asg = document.createElement('span');
      asg.className = 'pipeline-assignee';
      const header = card.querySelector('.pipeline-card-header');
      if (header) header.insertBefore(asg, statusEl);
    }
    asg.textContent = assignee;
  }
  if (error) {
    let errEl = card.querySelector('.pipeline-card-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'pipeline-card-error';
      card.appendChild(errEl);
    }
    errEl.textContent = error;
  }
}

function showApprovalModal(workflowId, taskId, command) {
  const modal = document.getElementById('modal-approval');
  const title = document.getElementById('approval-title');
  const body = document.getElementById('approval-body');
  const btnAllow = document.getElementById('btn-approval-allow');
  const btnDeny = document.getElementById('btn-approval-deny');

  if (!modal) return;
  if (title) title.textContent = 'Approval Command';
  if (body) body.textContent = command || '';
  modal.style.display = 'flex';

  const clean = () => {
    modal.style.display = 'none';
    btnAllow.onclick = null;
    btnDeny.onclick = null;
  };

  btnAllow.onclick = async () => {
    clean();
    await api.approveCommand(workflowId, taskId, true);
  };
  btnDeny.onclick = async () => {
    clean();
    await api.approveCommand(workflowId, taskId, false);
  };
}

function showInputModal(workflowId, taskId, question) {
  const answer = prompt(question || 'Input required');
  if (answer !== null) {
    api.approveCommand(workflowId, taskId, true, answer);
  } else {
    api.approveCommand(workflowId, taskId, false);
  }
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
