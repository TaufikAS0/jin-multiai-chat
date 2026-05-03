const { writeFile, readFile, editFile, listDir, executeCommand, askUser } = require('./toolkit');

const TOOLS = { writeFile, readFile, editFile, listDir, executeCommand, askUser };

function extractToolCalls(text) {
  const calls = [];
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const json = JSON.parse(match[1].trim());
      calls.push(json);
    } catch (e) {
      calls.push({ _raw: match[1].trim(), _error: e.message });
    }
  }
  return calls;
}

async function executeToolCalls(workspaceDir, calls) {
  const results = [];
  for (const call of calls) {
    if (call._error) {
      results.push({ tool: '_parse_error', error: call._error, raw: call._raw });
      continue;
    }
    const { tool, args = {} } = call;
    if (!TOOLS[tool]) {
      results.push({ tool, error: `Unknown tool: ${tool}` });
      continue;
    }
    try {
      const result = await TOOLS[tool](workspaceDir, args);
      results.push({ tool, args, result });
    } catch (e) {
      results.push({ tool, args, error: e.message, code: e.code, command: e.command, question: e.question });
    }
  }
  return results;
}

function hasToolCalls(text) {
  return /<tool_call>/.test(text);
}

module.exports = { extractToolCalls, executeToolCalls, hasToolCalls };
