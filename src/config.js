const path = require('path');

module.exports = {
  PORT: 3099,
  ROUTER_BASE: 'http://localhost:20128/v1',
  ROUTER_KEY: 'sk-71ef7ab15ed1b949-zyv5t8-be02a32e',
  DATA_DIR: path.join(__dirname, '..', 'data'),
  SESSIONS_DIR: path.join(__dirname, '..', 'data', 'sessions'),
  MEMORY_FILE: path.join(__dirname, '..', 'data', 'memory.json'),
};
