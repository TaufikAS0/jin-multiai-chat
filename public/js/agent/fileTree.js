import { getWorkspaceFiles } from '../api.js';

export async function renderFileTree(workflowId) {
  const container = document.getElementById('file-tree');
  if (!container) return;

  try {
    const tree = await getWorkspaceFiles(workflowId);
    container.innerHTML = '';
    if (!tree || !tree.length) {
      container.innerHTML = '<div class="loading-text">Workspace kosong</div>';
      return;
    }
    container.appendChild(buildTreeUl(tree));
  } catch (e) {
    container.innerHTML = `<div class="loading-text" style="color:var(--red)">${e.message}</div>`;
  }
}

function buildTreeUl(items) {
  const ul = document.createElement('ul');
  ul.className = 'file-tree-list';
  for (const item of items) {
    const li = document.createElement('li');
    if (item.type === 'directory') {
      li.innerHTML = `<span class="tree-dir">📁 ${esc(item.name)}</span>`;
      if (item.children && item.children.length) {
        li.appendChild(buildTreeUl(item.children));
      }
    } else {
      li.innerHTML = `<span class="tree-file">📄 ${esc(item.name)}</span>`;
    }
    ul.appendChild(li);
  }
  return ul;
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
