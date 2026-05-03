export function initModal(modal, nameInput, systemInput, cancelBtn, saveBtn, onSave) {
  cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
  saveBtn.addEventListener('click', () => {
    onSave({ name: nameInput.value.trim(), systemPrompt: systemInput.value.trim() });
    modal.style.display = 'none';
  });
}

export function openModal(modal, nameInput, systemInput, session) {
  nameInput.value = session.name || '';
  systemInput.value = session.systemPrompt || '';
  modal.style.display = 'flex';
}
