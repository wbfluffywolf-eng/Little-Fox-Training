const catheterStentValue = "catheter_stent_use";
const catheterStentNote = "Catheter / stent use.";

function removeCatheterStentSubcategory(select) {
  if (!select) return;
  const option = select.querySelector(`option[value="${catheterStentValue}"]`);
  if (!option) return;
  if (option.selected) {
    select.selectedIndex = 0;
  }
  option.remove();
}

function addCatheterStentNoteControl(textarea) {
  if (!textarea) return;
  const form = textarea.closest("form");
  const existing = form?.querySelector?.('[data-catheter-stent-note="true"]');
  const toggleRow = [...(form?.querySelectorAll?.(".pill-row") || [])].find(row =>
    row.querySelector('[name="leaked"]') || row.querySelector('[name="accident"]')
  );
  if (existing && toggleRow?.contains(existing)) return;
  existing?.remove();

  const label = document.createElement("label");
  label.dataset.catheterStentNote = "true";
  label.innerHTML = `<span><input type="checkbox" name="catheter_stent_note"> Catheter / stent use</span>`;
  if (toggleRow) {
    toggleRow.appendChild(label);
  } else {
    textarea.closest("label")?.insertAdjacentElement("afterend", label);
  }
}

function patchLogForms() {
  document.querySelectorAll('select[name="subcategory"]').forEach(removeCatheterStentSubcategory);
  document.querySelectorAll('textarea[name="notes"]').forEach(addCatheterStentNoteControl);
}

document.addEventListener("submit", event => {
  const form = event.target;
  if (!form?.querySelector?.('[name="catheter_stent_note"]:checked')) return;
  const notes = form.querySelector('textarea[name="notes"]');
  if (!notes) return;
  const current = notes.value.trim();
  if (current.toLowerCase().includes(catheterStentNote.toLowerCase())) return;
  notes.value = current ? `${current} ${catheterStentNote}` : catheterStentNote;
}, true);

document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="log"], [data-tab="cloth"], [data-log-my-diaper]')) {
    setTimeout(patchLogForms, 100);
  }
});

patchLogForms();
[500, 1500, 3000].forEach(delay => setTimeout(patchLogForms, delay));
