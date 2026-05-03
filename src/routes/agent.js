const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  listWorkflows,
  deleteWorkflow,
  getWorkspaceDir,
} = require('../db/workflows');
const { generatePlan } = require('../core/planner');
const { subscribe, unsubscribe, runWorkflow, approveCommand } = require('../core/orchestrator');

const router = express.Router();

// POST /api/agent/plan
router.post('/plan', async (req, res) => {
  try {
    const { goal, plannerModel, availableAgents } = req.body;
    if (!goal || !plannerModel || !availableAgents?.length) {
      return res.status(400).json({ error: 'goal, plannerModel, and availableAgents required' });
    }

    const workflow = createWorkflow({
      name: goal.slice(0, 80),
      goal,
      plannerModel,
      status: 'planning',
    });

    const plan = await generatePlan({ goal, availableAgents, plannerModel, workflowId: workflow.id });

    const tasks = plan.tasks.map(t => ({
      ...t,
      status: 'queued',
      iterations: 0,
      messages: [],
      result: '',
      toolCalls: [],
      pendingApproval: null,
    }));

    const enriched = { ...plan, tasks, status: 'planned' };
    Object.assign(workflow, enriched);
    updateWorkflow(workflow.id, workflow);

    res.json({ workflowId: workflow.id, ...plan });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/agent/run
router.post('/run', async (req, res) => {
  try {
    const { workflowId } = req.body;
    if (!workflowId) return res.status(400).json({ error: 'workflowId required' });
    const workflow = getWorkflow(workflowId);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    runWorkflow(workflowId);
    res.json({ ok: true, workflowId, status: 'running' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/agent/stream/:workflowId
router.get('/stream/:workflowId', (req, res) => {
  const { workflowId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  subscribe(workflowId, res);

  const workflow = getWorkflow(workflowId);
  if (workflow) {
    res.write(`data: ${JSON.stringify({ type: 'workflow_state', workflow })}\n\n`);
  }

  req.on('close', () => unsubscribe(workflowId, res));
});

// POST /api/agent/approve
router.post('/approve', async (req, res) => {
  try {
    const { workflowId, taskId, approved, answer } = req.body;
    if (!workflowId || !taskId) {
      return res.status(400).json({ error: 'workflowId and taskId required' });
    }
    await approveCommand(workflowId, taskId, approved === true, answer);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/agent/workflows
router.get('/workflows', (req, res) => {
  res.json(listWorkflows());
});

// GET /api/agent/workspaces/:workflowId/files
router.get('/workspaces/:workflowId/files', (req, res) => {
  try {
    const wsDir = getWorkspaceDir(req.params.workflowId);
    if (!fs.existsSync(wsDir)) return res.json([]);

    function tree(dir, base = '') {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      return items.map(item => {
        const rel = base ? `${base}/${item.name}` : item.name;
        if (item.isDirectory()) {
          return { name: item.name, type: 'directory', children: tree(path.join(dir, item.name), rel) };
        }
        return { name: item.name, type: 'file', path: rel };
      });
    }
    res.json(tree(wsDir));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/agent/workspaces/:workflowId/files/*path
router.get('/workspaces/:workflowId/files/*', (req, res) => {
  try {
    const wsDir = getWorkspaceDir(req.params.workflowId);
    const filePath = req.params[0];
    const target = path.join(wsDir, filePath);
    if (!target.startsWith(path.resolve(wsDir))) {
      return res.status(403).json({ error: 'Path traversal' });
    }
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'Not found' });
    const content = fs.readFileSync(target, 'utf8');
    res.json({ path: filePath, content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
