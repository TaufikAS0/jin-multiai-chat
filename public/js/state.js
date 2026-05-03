export const state = {
  // Chat mode
  models: [],
  selectedModels: new Set(),
  sessions: [],
  activeSessionId: null,
  streaming: false,
  abortController: null,

  // Agent mode
  appMode: 'chat', // 'chat' | 'agent'
  plannerModel: '',
  activeAgents: new Set(),
  currentWorkflow: null,
  workflows: [],
};
