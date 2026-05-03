const { ROUTER_BASE, ROUTER_KEY } = require('../config');
const { getWorkspaceDir } = require('../db/workflows');

const SYSTEM_PROMPT = `Kamu adalah Planner AI. Tugasmu memecah goal user menjadi sub-tasks dan menentukan mode eksekusi.

Aturan:
1. Analisis goal dan tentukan apakah sub-tasks bisa dikerjakan parallel (independen) atau harus sequential (bergantung hasil sebelumnya).
2. Output HANYA dalam format JSON berikut, tanpa markdown code block, tanpa penjelasan tambahan di luar JSON:

{
  "mode": "sequential" | "parallel",
  "reasoning": "penjelasan singkat mengapa memilih mode tersebut",
  "tasks": [
    {
      "id": "t1",
      "description": "deskripsi task lengkap untuk agent. Jika perlu membuat file, sebutkan nama file dan isinya secara detail",
      "assignee": "model-id-yang-cocok",
      "dependsOn": []
    }
  ]
}

3. "assignee" harus salah satu dari availableAgents yang diberikan.
4. Jika mode "parallel", dependsOn harus kosong [] untuk semua task.
5. Jika mode "sequential", task ke-N bisa bergantung pada task ke-(N-1) jika perlu.
6. Deskripsi task harus cukup detail agar agent tahu persis apa yang dikerjakan.
7. Jika task memerlukan tool (write_file, read_file, dll), sebutkan secara eksplisit di deskripsi.

JANGAN output selain JSON.`;

async function generatePlan({ goal, availableAgents, plannerModel, workflowId }) {
  const workspaceDir = getWorkspaceDir(workflowId);

  const userPrompt = `Goal: ${goal}

Available Agents: ${availableAgents.join(', ')}

Working Directory: ${workspaceDir}

Buat rencana kerja dalam format JSON sesuai instruksi.`;

  const response = await fetch(`${ROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: plannerModel,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Planner error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const plan = JSON.parse(jsonStr);

  if (!plan.mode || !['sequential', 'parallel'].includes(plan.mode)) {
    throw new Error('Invalid plan mode');
  }
  if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) {
    throw new Error('Invalid plan tasks');
  }
  for (const t of plan.tasks) {
    if (!availableAgents.includes(t.assignee)) {
      throw new Error(`Invalid assignee: ${t.assignee}`);
    }
  }

  return plan;
}

module.exports = { generatePlan };
