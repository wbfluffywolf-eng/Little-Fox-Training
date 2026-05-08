function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function uniqueProductLabel(label) {
  return String(label || "").replace(/\s+\([^)]*\)$/, "");
}

function setFieldHidden(field) {
  field.style.position = "absolute";
  field.style.width = "1px";
  field.style.height = "1px";
  field.style.opacity = "0";
  field.style.pointerEvents = "none";
}

function captureOptions(originalSelect, sizeField) {
  const originalValue = originalSelect.value;
  const captured = [];
  [...originalSelect.options].forEach(option => {
    originalSelect.value = option.value;
    originalSelect.dispatchEvent(new Event("change", { bubbles: true }));
    captured.push({
      value: option.value,
      label: uniqueProductLabel(option.textContent.trim()),
      size: sizeField.value || option.textContent.trim()
    });
  });
  originalSelect.value = originalValue;
  originalSelect.dispatchEvent(new Event("change", { bubbles: true }));
  return captured;
}

function buildGroupedControls(form, presetName, sizeName) {
  const originalPreset = form.elements[presetName];
  const originalSize = form.elements[sizeName];
  if (!originalPreset || !originalSize || form.dataset.sizeSelectFixed === "true") return;

  const productSelect = document.createElement("select");
  const sizeSelect = document.createElement("select");
  productSelect.dataset.sizeSelectProduct = "true";
  sizeSelect.dataset.sizeSelectSize = "true";

  originalPreset.before(productSelect);
  originalSize.before(sizeSelect);
  setFieldHidden(originalPreset);
  setFieldHidden(originalSize);
  form.dataset.sizeSelectFixed = "true";

  function rebuild() {
    const captured = captureOptions(originalPreset, originalSize);
    const grouped = new Map();
    captured.forEach(item => {
      if (!grouped.has(item.label)) grouped.set(item.label, []);
      grouped.get(item.label).push(item);
    });

    productSelect.innerHTML = [...grouped.keys()]
      .map(label => `<option value="${esc(label)}">${esc(label)}</option>`)
      .join("");

    function rebuildSizes() {
      const group = grouped.get(productSelect.value) || [];
      sizeSelect.innerHTML = group
        .map(item => `<option value="${esc(item.value)}">${esc(item.size)}</option>`)
        .join("");
      if (group[0]) {
        originalPreset.value = group[0].value;
        originalPreset.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }

    productSelect.onchange = rebuildSizes;
    sizeSelect.onchange = () => {
      originalPreset.value = sizeSelect.value;
      originalPreset.dispatchEvent(new Event("change", { bubbles: true }));
    };
    rebuildSizes();
  }

  rebuild();
  const type = form.elements.item_type;
  if (type) type.addEventListener("change", () => setTimeout(rebuild, 0));
}

function applyFixes() {
  const mainForm = document.getElementById("presetCatalogForm");
  if (mainForm) buildGroupedControls(mainForm, "preset", "size");
  const extraForm = document.getElementById("extraPresetForm");
  if (extraForm) buildGroupedControls(extraForm, "extra_preset", "extra_size");
}

new MutationObserver(applyFixes).observe(document.getElementById("app"), { childList: true, subtree: true });
applyFixes();
