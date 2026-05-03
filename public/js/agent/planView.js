export function renderPlanPreview(plan) {
  const container = document.getElementById('plan-preview');
  const empty = document.getElementById('agent-empty');
  const pipeline = document.getElementById('pipeline-view');
  const btnRun = document.getElementById('btn-run-workflow');
  const btnRegen = document.getElementById('btn-regen-plan');

  empty.style.display = 'none';
  pipeline.style.display = 'none';
  container.style.display = '';
  if (btnRun) btnRun.style.display = '';
  if (btnRegen) btnRegen.style.display = '';

  const card = document.createElement('div');
  card.className = 'plan-card';

  const header = document.createElement('div');
  header.className = 'plan-header';
  header.innerHTML = `<span class="plan-mode ${plan.mode}">${plan.mode.toUpperCase()}</span><span class="plan-reason">${esc(plan.reasoning || '')}</span>`;
  card.appendChild(header);

  const list = document.createElement('div');
  list.className = 'plan-tasks';
  (plan.tasks || []).forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'plan-task';
    item.innerHTML = `<div class="plan-task-num">${i + 1}</div>
      <div class="plan-task-body">
        <div class="plan-task-desc">${esc(t.description)}</div>
        <div class="plan-task-meta">Assignee: <strong>${esc(t.assignee)}</strong>${t.dependsOn?.length ? ` · Depends: ${t.dependsOn.join(', ')}` : ''}</div>
      </div>`;
    list.appendChild(item);
  });
  card.appendChild(list);

  container.innerHTML = '';
  container.appendChild(card);
}

export function clearPlanPreview() {
  const container = document.getElementById('plan-preview');
  const empty = document.getElementById('agent-empty');
  const btnRun = document.getElementById('btn-run-workflow');
  const btnRegen = document.getElementById('btn-regen-plan');
  if (container) container.style.display = 'none';
  if (empty) empty.style.display = '';
  if (btnRun) btnRun.style.display = 'none';
  if (btnRegen) btnRegen.style.display = 'none';
}

function esc(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
