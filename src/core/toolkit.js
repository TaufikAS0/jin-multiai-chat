const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function resolveWorkspacePath(workspaceDir, filePath) {
  const resolved = path.resolve(path.join(workspaceDir, filePath || '.'));
  if (!resolved.startsWith(path.resolve(workspaceDir))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

function writeFile(workspaceDir, args) {
  const filePath = args.path || args.filePath;
  const content = args.content || '';
  if (!filePath) throw new Error('path is required');
  const target = resolveWorkspacePath(workspaceDir, filePath);
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return { ok: true, path: filePath, bytes: Buffer.byteLength(content, 'utf8') };
}

function readFile(workspaceDir, args) {
  const filePath = args.path || args.filePath;
  if (!filePath) throw new Error('path is required');
  const target = resolveWorkspacePath(workspaceDir, filePath);
  if (!fs.existsSync(target)) throw new Error(`File not found: ${filePath}`);
  const content = fs.readFileSync(target, 'utf8');
  return { ok: true, path: filePath, content };
}

function editFile(workspaceDir, args) {
  const filePath = args.path || args.filePath;
  const oldString = args.oldString;
  const newString = args.newString;
  if (!filePath) throw new Error('path is required');
  if (oldString === undefined) throw new Error('oldString is required');
  const target = resolveWorkspacePath(workspaceDir, filePath);
  if (!fs.existsSync(target)) throw new Error(`File not found: ${filePath}`);
  let content = fs.readFileSync(target, 'utf8');
  if (!content.includes(oldString)) throw new Error(`oldString not found in file: ${filePath}`);
  content = content.replace(oldString, newString);
  fs.writeFileSync(target, content, 'utf8');
  return { ok: true, path: filePath, replacements: 1 };
}

function listDir(workspaceDir, args) {
  const dirPath = (args && args.path) || '.';
  const target = resolveWorkspacePath(workspaceDir, dirPath);
  if (!fs.existsSync(target)) throw new Error(`Directory not found: ${dirPath}`);
  const items = fs.readdirSync(target, { withFileTypes: true }).map(item => ({
    name: item.name,
    type: item.isDirectory() ? 'directory' : 'file',
  }));
  return { ok: true, path: dirPath, items };
}

// Whitelist untuk command yang boleh langsung dieksekusi tanpa approval
const WHITELIST = [
  /^node\s+[\w\-\.\/\\:]+\.js(\s.*)?$/i,
  /^npm\s+(start|run|test|install|ci)(\s.*)?$/i,
  /^python\s+[\w\-\.\/\\:]+\.py(\s.*)?$/i,
  /^type\s+.+$/i,
  /^dir(\s.*)?$/i,
  /^echo\s+.+$/i,
];

function isWhitelisted(command) {
  return WHITELIST.some(re => re.test(command.trim()));
}

function executeCommand(workspaceDir, args) {
  const command = args.command;
  const force = args.force === true;
  if (!command) throw new Error('command is required');
  if (!force && !isWhitelisted(command)) {
    const err = new Error('Command requires user approval');
    err.code = 'NEEDS_APPROVAL';
    err.command = command;
    throw err;
  }

  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-Command', command], {
      cwd: workspaceDir,
      timeout: 30000,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('close', code => {
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.slice(0, 10000),
        stderr: stderr.slice(0, 10000),
      });
    });
    child.on('error', reject);
  });
}

function askUser(workspaceDir, args) {
  const question = args.question || 'Input required';
  const err = new Error(question);
  err.code = 'NEEDS_USER_INPUT';
  err.question = question;
  throw err;
}

module.exports = {
  writeFile,
  readFile,
  editFile,
  listDir,
  executeCommand,
  askUser,
};
