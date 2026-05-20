const presets = [
  { category: "Supplies", brand: "", item: "Baby powder" },
  { category: "Supplies", brand: "", item: "Diaper rash cream" },
  { category: "Supplies", brand: "", item: "Barrier cream" },
  { category: "Supplies", brand: "", item: "Wipes" },
  { category: "Supplies", brand: "", item: "Changing pads" },
  { category: "Supplies", brand: "", item: "Disposable gloves" },
  { category: "Supplies", brand: "", item: "Disposal bags" },
  { category: "Supplies", brand: "", item: "Odor control bags" },
  { category: "Supplies", brand: "", item: "Laundry detergent" },
  { category: "Supplies", brand: "", item: "Waterproof mattress protector" },
  { category: "Supplies", brand: "", item: "Bed pads / underpads" },
  { category: "Supplies", brand: "", item: "Changing mat" }
];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentTitle() {
  return document.querySelector(".topbar h2")?.textContent.trim() || "";
}

function expenseForm() {
  return document.getElementById("expenseForm");
}

function setField(form, name, value) {
  const field = form.querySelector(`[name="${name}"]`);
  if (field) field.value = value;
}

function fillPreset(preset) {
  const form = expenseForm();
  if (!form) return;
  setField(form, "category", preset.category);
  setField(form, "brand", preset.brand);
  setField(form, "item", preset.item);
  setField(form, "amount", "");
  setField(form, "expense_date", today());
  form.querySelector('[name="amount"]')?.focus();
}

function injectQuickAdd() {
  if (currentTitle() !== "Expenses") return;
  const form = expenseForm();
  if (!form || document.getElementById("expenseQuickAddCard")) return;
  form.closest(".card")?.insertAdjacentHTML("afterend", `
    <article class="card" id="expenseQuickAddCard" style="margin-top:14px">
      <h3>Quick Add Supplies</h3>
      <div class="pill-row" style="margin-top:12px">
        ${presets.map((preset, index) => `
          <button class="btn secondary" type="button" data-expense-preset="${index}">
            ${esc(preset.item)}
          </button>
        `).join("")}
      </div>
    </article>
  `);
}

document.addEventListener("click", event => {
  const presetButton = event.target.closest("[data-expense-preset]");
  if (presetButton) {
    fillPreset(presets[Number(presetButton.dataset.expensePreset)]);
    return;
  }
  if (event.target.closest('[data-tab="expenses"], [data-tab]')) {
    setTimeout(injectQuickAdd, 150);
  }
});

new MutationObserver(injectQuickAdd).observe(document.body, { childList: true, subtree: true });
[0, 600, 1500].forEach(delay => setTimeout(injectQuickAdd, delay));
