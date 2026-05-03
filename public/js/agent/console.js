export function logConsole(source, message) {
  const container = document.getElementById('agent-console');
  if (!container) return;
  const line = document.createElement('div');
  line.className = `console-line ${source}`;
  const time = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  line.innerHTML = `<span class="console-time">${time}</span><span class="console-source">${esc(String(source))}</span><span class="console-msg">${esc(String(message))}</span>`;
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
