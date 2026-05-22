const extraOptionsKey = "littleFoxLogExtraOptions";
const defaultExtraOptions = {
  cathStent: true,
  chastity: false,
  buttPlug: false
};

function loadExtraOptions() {
  try {
    return { ...defaultExtraOptions, ...JSON.parse(localStorage.getItem(extraOptionsKey) || "{}") };
  } catch {
    return { ...defaultExtraOptions };
  }
}

function saveExtraOptions(options) {
  localStorage.setItem(extraOptionsKey, JSON.stringify(options));
}

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function extraOptionsPanel() {
  const panel = document.querySelector("[data-log-auto-panel]");
  if (!panel || panel.querySelector("[data-log-extra-options]")) return;
  const options = loadExtraOptions();
  const wrap = document.createElement("div");
  wrap.dataset.logExtraOptions = "true";
  wrap.className = "form-grid";
  wrap.innerHTML = `
    <strong>Log Change Options</strong>
    <label>
      <input type="checkbox" name="show_cath_stent" ${options.cathStent ? "checked" : ""}>
      <span>Show cath / stent use</span>
    </label>
    <label>
      <input type="checkbox" name="show_chastity" ${options.chastity ? "checked" : ""}>
      <span>Show chastity use</span>
    </label>
    <label>
      <input type="checkbox" name="show_butt_plug" ${options.buttPlug ? "checked" : ""}>
      <span>Show butt plug use</span>
    </label>
  `;
  const saveButton = panel.querySelector("[data-save-auto-slots]");
  panel.insertBefore(wrap, saveButton || null);
}

function removeCathStentControls(form) {
  form.querySelector('[data-catheter-stent-note="true"]')?.remove();
  form.querySelector('[data-cath-stent-state="true"]')?.remove();
}

function checkboxRow(form) {
  return [...(form?.querySelectorAll?.(".pill-row") || [])].find(row =>
    row.querySelector('[name="leaked"]') || row.querySelector('[name="accident"]')
  );
}

function notesLabel(form) {
  return form.querySelector('textarea[name="notes"]')?.closest("label") || null;
}

function injectCathStentControls(form) {
  if (form.querySelector('[data-catheter-stent-note="true"]')) return;
  const row = checkboxRow(form);
  const notes = notesLabel(form);
  if (!row && !notes) return;
  const check = document.createElement("label");
  check.dataset.catheterStentNote = "true";
  check.innerHTML = `<span><input type="checkbox" name="catheter_stent_note"> Cath / stent use</span>`;
  if (row) row.appendChild(check);
  else notes.insertAdjacentElement("beforebegin", check);

  if (form.querySelector('[data-cath-stent-state="true"]')) return;
  const state = document.createElement("label");
  state.dataset.cathStentState = "true";
  state.innerHTML = `Cath / stent state<select name="catheter_stent_state">
    <option value="">Choose if needed</option>
    <option value="catheter in">Catheter in</option>
    <option value="stent in">Stent in</option>
    <option value="catheter and stent in">Catheter and stent in</option>
    <option value="changed or cleaned">Changed or cleaned</option>
    <option value="leaking around it">Leaking around it</option>
    <option value="blocked or kinked">Blocked or kinked</option>
    <option value="irritated or sore">Irritated or sore</option>
    <option value="removed">Removed</option>
  </select>`;
  notes?.insertAdjacentElement("beforebegin", state);
}

function removeChastityControls(form) {
  form.querySelector('[data-chastity-note="true"]')?.remove();
  form.querySelector('[data-chastity-state="true"]')?.remove();
}

function removeButtPlugControls(form) {
  form.querySelector('[data-butt-plug-note="true"]')?.remove();
  form.querySelector('[data-butt-plug-state="true"]')?.remove();
}

function injectChastityControls(form) {
  if (form.querySelector('[data-chastity-note="true"]')) return;
  const row = checkboxRow(form);
  const notes = notesLabel(form);
  if (!row && !notes) return;
  const check = document.createElement("label");
  check.dataset.chastityNote = "true";
  check.innerHTML = `<span><input type="checkbox" name="chastity_note"> Chastity use</span>`;
  if (row) row.appendChild(check);
  else notes.insertAdjacentElement("beforebegin", check);
  if (form.querySelector('[data-chastity-state="true"]')) return;
  const state = document.createElement("label");
  state.dataset.chastityState = "true";
  state.innerHTML = `Chastity state<select name="chastity_state">
    <option value="locked">Locked</option>
    <option value="unlocked">Unlocked</option>
    <option value="changed cage">Changed cage</option>
    <option value="cleaning">Cleaning</option>
    <option value="discomfort">Discomfort</option>
  </select>`;
  notes?.insertAdjacentElement("beforebegin", state);
}

function injectButtPlugControls(form) {
  if (form.querySelector('[data-butt-plug-note="true"]')) return;
  const row = checkboxRow(form);
  const notes = notesLabel(form);
  if (!row && !notes) return;
  const check = document.createElement("label");
  check.dataset.buttPlugNote = "true";
  check.innerHTML = `<span><input type="checkbox" name="butt_plug_note"> Butt plug use</span>`;
  if (row) row.appendChild(check);
  else notes.insertAdjacentElement("beforebegin", check);
  if (form.querySelector('[data-butt-plug-state="true"]')) return;
  const state = document.createElement("label");
  state.dataset.buttPlugState = "true";
  state.innerHTML = `Butt plug state<select name="butt_plug_state">
    <option value="in">In</option>
    <option value="removed">Removed</option>
    <option value="changed">Changed</option>
    <option value="cleaning">Cleaning</option>
    <option value="discomfort">Discomfort</option>
  </select>`;
  notes?.insertAdjacentElement("beforebegin", state);
}

function applyControls() {
  extraOptionsPanel();
  const options = loadExtraOptions();
  document.querySelectorAll("#logForm, #clothWearForm").forEach(form => {
    if (options.cathStent) injectCathStentControls(form);
    else removeCathStentControls(form);
    if (options.chastity) injectChastityControls(form);
    else removeChastityControls(form);
    if (options.buttPlug) injectButtPlugControls(form);
    else removeButtPlugControls(form);
  });
}

function appendChastityNote(form) {
  if (!loadExtraOptions().chastity) return;
  if (!form.querySelector('[name="chastity_note"]:checked')) return;
  const notes = form.querySelector('textarea[name="notes"]');
  if (!notes) return;
  const state = form.querySelector('[name="chastity_state"]')?.value;
  const addition = state ? `Chastity use: ${state}.` : "Chastity use.";
  const current = notes.value.trim();
  if (current.toLowerCase().includes("chastity use")) return;
  notes.value = current ? `${current} ${addition}` : addition;
}

function appendButtPlugNote(form) {
  if (!loadExtraOptions().buttPlug) return;
  if (!form.querySelector('[name="butt_plug_note"]:checked')) return;
  const notes = form.querySelector('textarea[name="notes"]');
  if (!notes) return;
  const state = form.querySelector('[name="butt_plug_state"]')?.value;
  const addition = state ? `Butt plug use: ${state}.` : "Butt plug use.";
  const current = notes.value.trim();
  if (current.toLowerCase().includes("butt plug use")) return;
  notes.value = current ? `${current} ${addition}` : addition;
}

document.addEventListener("change", event => {
  const input = event.target.closest?.('[data-log-extra-options] input[type="checkbox"]');
  if (!input) return;
  const options = loadExtraOptions();
  if (input.name === "show_cath_stent") options.cathStent = input.checked;
  if (input.name === "show_chastity") options.chastity = input.checked;
  if (input.name === "show_butt_plug") options.buttPlug = input.checked;
  saveExtraOptions(options);
  applyControls();
  toast("Log change options saved.");
});

document.addEventListener("click", event => {
  const form = event.target.closest?.('#logForm button[type="submit"], #clothWearForm button[type="submit"]')?.closest("form");
  if (form) {
    appendChastityNote(form);
    appendButtPlugNote(form);
  }
  if (event.target.closest?.("[data-tab]")) setTimeout(applyControls, 180);
}, true);

document.addEventListener("submit", event => {
  if (event.target?.matches?.("#logForm, #clothWearForm")) {
    appendChastityNote(event.target);
    appendButtPlugNote(event.target);
  }
}, true);

new MutationObserver(applyControls).observe(document.body, { childList: true, subtree: true });
[0, 400, 1000, 2200].forEach(delay => setTimeout(applyControls, delay));
