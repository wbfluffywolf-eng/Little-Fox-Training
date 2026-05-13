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
  if (!textarea || textarea.closest("label")?.nextElementSibling?.dataset?.catheterStentNote === "true") return;
  const label = document.createElement("label");
  label.dataset.catheterStentNote = "true";
  label.innerHTML = `<span><input type="checkbox" name="catheter_stent_note"> Catheter / stent use</span>`;
  textarea.closest("label")?.insertAdjacentElement("afterend", label);
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

new MutationObserver(patchLogForms).observe(document.getElementById("app"), {
  childList: true,
  subtree: true
});

patchLogForms();
