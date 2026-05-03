const fs = require('fs');
const path = require('path');
const { SESSIONS_DIR } = require('../config');

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

function formatDate(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function saveSessionMd(session) {
  const filePath = path.join(SESSIONS_DIR, `${session.id}.md`);

  // YAML frontmatter
  const modelsList = (session.models || []).map(m => `  - ${m}`).join('\n');
  let md = `---\ntitle: "${session.name.replace(/"/g, "'")}"\nid: "${session.id}"\ncreated: "${session.created}"\nupdated: "${new Date().toISOString()}"\nmodels:\n${modelsList}\ntags: [ai-chat, multiai]\n---\n\n# ${session.name}\n\n`;

  // Group messages into turns
  const turns = [];
  let currentTurn = null;
  for (const msg of (session.messages || [])) {
    if (msg.role === 'user') {
      currentTurn = { user: msg, responses: [] };
      turns.push(currentTurn);
    } else if (msg.role === 'assistant' && currentTurn) {
      currentTurn.responses.push(msg);
    }
  }

  turns.forEach((turn, i) => {
    md += `## Turn ${i + 1} · ${formatDate(turn.user.timestamp)}\n\n`;
    md += `**Kamu:** ${turn.user.content}\n\n`;

    turn.responses.forEach((r, ri) => {
      md += `### ${r.model}\n`;
      if (ri > 0) {
        const prev = turn.responses.slice(0, ri).map(p => p.model).join(', ');
        md += `*(menerima konteks dari: ${prev})*\n\n`;
      }
      md += `${r.content}\n\n`;
    });

    md += `---\n\n`;
  });

  fs.writeFileSync(filePath, md, 'utf8');
}

module.exports = { saveSessionMd };
