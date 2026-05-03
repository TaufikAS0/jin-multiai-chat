const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');

const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json');
const WORKSPACE_DIR = path.join(DATA_DIR, 'workspace');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(WORKSPACE_DIR)) fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  if (!fs.existsSync(WORKFLOWS_FILE)) fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify({ workflows: [] }, null, 2));
}

function readWorkflows() {
  ensureDirs();
  return JSON.parse(fs.readFileSync(WORKFLOWS_FILE, 'utf8'));
}

function writeWorkflows(data) {
  fs.writeFileSync(WORKFLOWS_FILE, JSON.stringify(data, null, 2));
}

function createWorkflow(data) {
  const wf = readWorkflows();
  const workflow = {
    id: `wf-${Date.now()}`,
    name: data.name || 'Workflow',
    goal: data.goal || '',
    plannerModel: data.plannerModel || '',
    mode: data.mode || 'sequential',
    status: 'planning',
    tasks: data.tasks || [],
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    ...data,
  };
  wf.workflows.unshift(workflow);
  writeWorkflows(wf);

  const wsDir = path.join(WORKSPACE_DIR, workflow.id);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });

  return workflow;
}

function getWorkflow(id) {
  return readWorkflows().workflows.find(w => w.id === id) || null;
}

function updateWorkflow(id, patch) {
  const wf = readWorkflows();
  const idx = wf.workflows.findIndex(w => w.id === id);
  if (idx === -1) return null;
  wf.workflows[idx] = { ...wf.workflows[idx], ...patch, updated: new Date().toISOString() };
  writeWorkflows(wf);
  return wf.workflows[idx];
}

function deleteWorkflow(id) {
  const wf = readWorkflows();
  wf.workflows = wf.workflows.filter(w => w.id !== id);
  writeWorkflows(wf);
  const wsDir = path.join(WORKSPACE_DIR, id);
  if (fs.existsSync(wsDir)) fs.rmSync(wsDir, { recursive: true, force: true });
  return true;
}

function listWorkflows() {
  return readWorkflows().workflows;
}

function getWorkspaceDir(workflowId) {
  return path.join(WORKSPACE_DIR, workflowId);
}

module.exports = {
  createWorkflow,
  getWorkflow,
  updateWorkflow,
  deleteWorkflow,
  listWorkflows,
  getWorkspaceDir,
};
