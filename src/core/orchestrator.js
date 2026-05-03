const { getWorkflow, updateWorkflow, getWorkspaceDir } = require('../db/workflows');
const { streamFromRouter } = require('../lib/router');
const { extractToolCalls, executeToolCalls, hasToolCalls } = require('./toolParser');

const clients = new Map();         // workflowId -> Set<Response>
const activeWorkflows = new Map(); // workflowId -> workflow object (in-memory cache)
const activeTasks = new Map();     // "wfId-taskId" -> Promise

const MAX_ITERATIONS = 10;

const SYSTEM_PROMPT = `Kamu adalah AI Agent. Tugasmu menyelesaikan task yang diberikan.
Kamu memiliki akses ke tools berikut:
- write_file: Buat/overwrite file. Args: {"path": "...", "content": "..."}
- read_file: Baca file. Args: {"path": "..."}
- edit_file: Edit file dengan search & replace. Args: {"path": "...", "oldString": "...", "newString": "..."}
- list_dir: List isi direktori. Args: {"path": "..."}
- execute_command: Jalankan shell command (whitelist). Args: {"command": "..."}
- ask_user: Tanya ke user jika bingung. Args: {"question": "..."}

Format tool call (panggil satu atau lebih):
<tool_call>
{"tool": "write_file", "args": {"path": "file.txt", "content": "hello"}}
</tool_call>

Aturan:
1. Pikirkan langkah demi langkah.
2. Jika perlu tool, panggil dengan format di atas.
3. Jika tidak perlu tool lagi, berikan jawaban final.
4. JANGAN gunakan markdown code block untuk tool call. Gunakan format XML <tool_call> persis seperti di atas.
5. Working directory kamu adalah: {workspaceDir}
6. Jika command ditolak user, cari alternatif lain. Jangan stuck.`;

// ── SSE Broadcast ────────────────────────────────────────────────────────────
function subscribe(workflowId, res) {
  if (!clients.has(workflowId)) clients.set(workflowId, new Set());
  clients.get(workflowId).add(res);
}

function unsubscribe(workflowId, res) {
  clients.get(workflowId)?.delete(res);
}

function broadcast(workflowId, event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  clients.get(workflowId)?.forEach(res => {
    try { res.write(data); } catch { /* closed */ }
  });
}

// ── Workflow Cache ───────────────────────────────────────────────────────────
function loadWorkflow(workflowId) {
  if (!activeWorkflows.has(workflowId)) {
    const w = getWorkflow(workflowId);
    if (w) activeWorkflows.set(workflowId, w);
  }
  return activeWorkflows.get(workflowId);
}

function persistWorkflow(workflowId) {
  const w = activeWorkflows.get(workflowId);
  if (w) updateWorkflow(workflowId, w);
}

// ── Public API ───────────────────────────────────────────────────────────────
async function runWorkflow(workflowId) {
  const workflow = loadWorkflow(workflowId);
  if (!workflow) return;
  if (['done', 'failed'].includes(workflow.status)) return;

  workflow.status = 'running';
  persistWorkflow(workflowId);
  broadcast(workflowId, { type: 'workflow_start', workflowId, mode: workflow.mode });

  try {
    if (workflow.mode === 'sequential') {
      for (const task of workflow.tasks) {
        const w = loadWorkflow(workflowId);
        const t = w.tasks.find(x => x.id === task.id);
        if (!t) continue;
        if (t.status === 'done') continue;
        if (t.status === 'failed') {
          w.status = 'failed';
          persistWorkflow(workflowId);
          break;
        }
        await runTaskWithTracking(w, t);
        if (loadWorkflow(workflowId)?.status === 'paused') return;
      }
    } else {
      await runParallel(workflowId);
    }

    const w = loadWorkflow(workflowId);
    if (w && !['paused', 'failed'].includes(w.status)) {
      w.status = 'done';
      persistWorkflow(workflowId);
      broadcast(workflowId, { type: 'workflow_done', workflowId });
    }
  } catch (e) {
    const w = loadWorkflow(workflowId);
    if (w) { w.status = 'failed'; persistWorkflow(workflowId); }
    broadcast(workflowId, { type: 'workflow_error', workflowId, error: e.message });
  }
}

async function approveCommand(workflowId, taskId, approved, answer) {
  const workflow = loadWorkflow(workflowId);
  if (!workflow) throw new Error('Workflow not found');
  const task = workflow.tasks.find(t => t.id === taskId);
  if (!task) throw new Error('Task not found');
  if (task.status !== 'paused') throw new Error('Task not paused');

  if (task.pendingApproval?.type === 'command') {
    if (!approved) {
      task.messages.push({
        role: 'system',
        content: `User DENIED the command execution (${task.pendingApproval.command}). Do not execute it. Proceed with alternative approach.`,
      });
    } else {
      const { executeCommand } = require('./toolkit');
      const result = await executeCommand(getWorkspaceDir(workflowId), {
        command: task.pendingApproval.command,
        force: true,
      });
      task.messages.push({
        role: 'system',
        content: `[Tool execute_command RESULT]: ${JSON.stringify(result)}`,
      });
    }
  } else if (task.pendingApproval?.type === 'question') {
    task.messages.push({ role: 'user', content: `User answer: ${answer}` });
  }

  task.pendingApproval = null;
  task.status = 'running';
  persistWorkflow(workflowId);
  broadcast(workflowId, { type: 'task_resumed', taskId });

  // Continue workflow
  runWorkflow(workflowId);
}

// ── Internal ─────────────────────────────────────────────────────────────────
async function runParallel(workflowId) {
  while (true) {
    const w = loadWorkflow(workflowId);
    if (!w) break;

    const allSettled = w.tasks.every(t => ['done', 'failed'].includes(t.status));
    if (allSettled) break;

    const ready = w.tasks.filter(t =>
      t.status === 'queued' &&
      t.dependsOn.every(depId => w.tasks.find(x => x.id === depId)?.status === 'done')
    );
    const runningNoPromise = w.tasks.filter(t =>
      t.status === 'running' && !activeTasks.has(`${workflowId}-${t.id}`)
    );

    if (ready.length === 0 && runningNoPromise.length === 0 && activeTasks.size === 0) break;

    for (const task of ready) runTaskWithTracking(w, task);
    for (const task of runningNoPromise) runTaskWithTracking(w, task);

    await new Promise(r => setTimeout(r, 500));
  }
}

function runTaskWithTracking(workflow, task) {
  const key = `${workflow.id}-${task.id}`;
  if (activeTasks.has(key)) return activeTasks.get(key);
  const promise = runTask(workflow, task).finally(() => activeTasks.delete(key));
  activeTasks.set(key, promise);
  return promise;
}

async function runTask(workflow, task) {
  const workflowId = workflow.id;
  task.status = 'running';
  task.iterations = task.iterations || 0;
  task.messages = task.messages || [];
  task.toolCalls = task.toolCalls || [];

  if (task.messages.length === 0) {
    task.messages.push({
      role: 'system',
      content: SYSTEM_PROMPT.replace('{workspaceDir}', getWorkspaceDir(workflowId)),
    });
    task.messages.push({
      role: 'user',
      content: `Task: ${task.description}\n\nSelesaikan task ini. Gunakan tool jika perlu.`,
    });
  }

  persistWorkflow(workflowId);
  broadcast(workflowId, { type: 'task_start', taskId: task.id, assignee: task.assignee });

  while (task.iterations < MAX_ITERATIONS) {
    task.iterations++;
    persistWorkflow(workflowId);

    const aiResponse = await callAI(task.assignee, task.messages);
    task.messages.push({ role: 'assistant', content: aiResponse });

    if (!hasToolCalls(aiResponse)) {
      task.status = 'done';
      task.result = aiResponse;
      persistWorkflow(workflowId);
      broadcast(workflowId, { type: 'task_done', taskId: task.id, result: aiResponse });
      return;
    }

    const calls = extractToolCalls(aiResponse);
    broadcast(workflowId, { type: 'task_tools', taskId: task.id, calls });

    const results = await executeToolCalls(getWorkspaceDir(workflowId), calls);

    for (const r of results) {
      task.toolCalls.push(r);
      if (r.code === 'NEEDS_APPROVAL') {
        task.status = 'paused';
        task.pendingApproval = { type: 'command', command: r.command };
        persistWorkflow(workflowId);
        broadcast(workflowId, { type: 'needs_approval', taskId: task.id, command: r.command });
        return;
      }
      if (r.code === 'NEEDS_USER_INPUT') {
        task.status = 'paused';
        task.pendingApproval = { type: 'question', question: r.question };
        persistWorkflow(workflowId);
        broadcast(workflowId, { type: 'needs_input', taskId: task.id, question: r.question });
        return;
      }
    }

    const resultText = results.map(r => {
      if (r.error) return `[Tool ${r.tool} ERROR]: ${r.error}`;
      return `[Tool ${r.tool} RESULT]: ${JSON.stringify(r.result)}`;
    }).join('\n\n');

    task.messages.push({ role: 'system', content: `Tool execution results:\n${resultText}` });
    broadcast(workflowId, { type: 'tool_results', taskId: task.id, results });
    persistWorkflow(workflowId);
  }

  task.status = 'failed';
  task.result = 'Max iterations reached';
  persistWorkflow(workflowId);
  broadcast(workflowId, { type: 'task_failed', taskId: task.id, error: 'Max iterations reached' });
}

async function callAI(model, messages) {
  const response = await streamFromRouter(messages, model);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        content += parsed.choices?.[0]?.delta?.content || '';
      } catch {}
    }
  }
  return content;
}

module.exports = {
  subscribe,
  unsubscribe,
  runWorkflow,
  approveCommand,
};
