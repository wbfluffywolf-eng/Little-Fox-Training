import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let catalog = [];
let ready = false;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3200);
}

async function loadOwnerContext() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;
  const { data: memberships } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", session.user.id)
    .eq("status", "active");
  const member = memberships?.[0];
  const household = member?.households;
  const isOwner = member?.role === "owner" || household?.owner_id === session.user.id;
  return isOwner ? { household } : null;
}

function parseOptionLabel(label) {
  const clean = String(label || "").replace(/\s+\([^)]*\)$/, "").trim();
  const parts = clean.split(" - ");
  return {
    brand: parts[0]?.trim() || "Unknown",
    style: parts.slice(1).join(" - ").trim() || clean || "Preset"
  };
}

function currentSelect(form, name) {
  const field = form.elements[name];
  if (!field) return "";
  if (field.tagName === "SELECT") return field.options[field.selectedIndex]?.textContent.trim() || field.value;
  return field.value || "";
}

function collectFromMainForm(form) {
  const collected = [];
  const typeSelect = form.elements.item_type;
  const presetSelect = form.elements.preset;
  if (!typeSelect || !presetSelect) return collected;
  [...typeSelect.options].forEach(typeOption => {
    typeSelect.value = typeOption.value;
    typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    [...presetSelect.options].forEach(option => {
      presetSelect.value = option.value;
      presetSelect.dispatchEvent(new Event("change", { bubbles: true }));
      const label = parseOptionLabel(option.textContent);
      collected.push({
        item_type: typeOption.value,
        type_label: typeOption.textContent.trim(),
        brand: label.brand,
        style: label.style,
        size: currentSelect(form, "size"),
        stock_count: Number(form.elements.stock_count?.value || 1),
        clean_count: Number(form.elements.clean_count?.value || 0),
        purchase_price: Number(form.elements.purchase_price?.value || 0)
      });
    });
  });
  return collected;
}

function collectFromExtraForm(form) {
  const collected = [];
  const presetSelect = form.elements.extra_preset;
  if (!presetSelect) return collected;
  [...presetSelect.options].forEach(option => {
    presetSelect.value = option.value;
    presetSelect.dispatchEvent(new Event("change", { bubbles: true }));
    const label = parseOptionLabel(option.textContent);
    collected.push({
      item_type: "disposable",
      type_label: "Disposable diaper",
      brand: label.brand,
      style: label.style,
      size: currentSelect(form, "extra_size"),
      stock_count: Number(form.elements.extra_stock_count?.value || 1),
      clean_count: 0,
      purchase_price: Number(form.elements.extra_purchase_price?.value || 0)
    });
  });
  return collected;
}

function uniqueItems(items) {
  const map = new Map();
  items.forEach(item => {
    const key = [item.item_type, item.brand, item.style, item.size, item.stock_count].join("|").toLowerCase();
    if (!map.has(key)) map.set(key, item);
  });
  return [...map.values()].sort((a, b) => `${a.brand} ${a.style} ${a.size}`.localeCompare(`${b.brand} ${b.style} ${b.size}`));
}

function removeOldPresetCards() {
  document.querySelectorAll(".card").forEach(card => {
    const title = card.querySelector("h3")?.textContent.trim();
    if (["Quick Add Preset", "More Product Presets", "More Disposable Presets"].includes(title)) card.remove();
  });
}

function optionList(values) {
  return values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
}

function packageLabel(item) {
  const count = Number(item.stock_count || 1);
  const lower = `${item.size} ${item.style}`.toLowerCase();
  if (lower.includes("sample")) return `Sample / ${count}`;
  if (lower.includes("case") || count >= 30) return `Case / ${count}`;
  if (count > 1) return `Bag or pack / ${count}`;
  return "Single item / 1";
}

function selectedItem(form) {
  return catalog.find(item =>
    item.brand === form.elements.brand.value &&
    `${item.type_label}: ${item.style}` === form.elements.product.value &&
    item.size === form.elements.size.value &&
    packageLabel(item) === form.elements.package.value
  ) || catalog[0];
}

function refreshProducts(form) {
  const products = [...new Set(catalog
    .filter(item => item.brand === form.elements.brand.value)
    .map(item => `${item.type_label}: ${item.style}`))];
  form.elements.product.innerHTML = optionList(products);
  refreshSizes(form);
}

function refreshSizes(form) {
  const sizes = [...new Set(catalog
    .filter(item => item.brand === form.elements.brand.value && `${item.type_label}: ${item.style}` === form.elements.product.value)
    .map(item => item.size))];
  form.elements.size.innerHTML = optionList(sizes);
  refreshPackages(form);
}

function refreshPackages(form) {
  const packages = [...new Set(catalog
    .filter(item =>
      item.brand === form.elements.brand.value &&
      `${item.type_label}: ${item.style}` === form.elements.product.value &&
      item.size === form.elements.size.value)
    .map(packageLabel))];
  form.elements.package.innerHTML = optionList(packages);
  refreshDetails(form);
}

function refreshDetails(form) {
  const item = selectedItem(form);
  form.elements.stock_count.value = item?.stock_count || 1;
  form.elements.purchase_price.value = Number(item?.purchase_price || 0).toFixed(2);
  form.querySelector("[data-unified-detail]").innerHTML = item
    ? `<strong>${esc(item.brand)} ${esc(item.style)}</strong><br>${esc(item.type_label)} - ${esc(item.size)} - ${esc(packageLabel(item))}`
    : "";
}

function cardHtml() {
  const brands = [...new Set(catalog.map(item => item.brand))];
  return `
    <article class="card" id="unifiedPresetCard" style="margin-top:14px">
      <h3>Quick Add Preset</h3>
      <p>Choose one preset by brand, product type, size, then case or bag count.</p>
      <form id="unifiedPresetForm" class="form-grid" style="margin-top:12px">
        <label>Brand<select name="brand">${optionList(brands)}</select></label>
        <label>Product type<select name="product"></select></label>
        <label>Size<select name="size"></select></label>
        <label>Case or bag<select name="package"></select></label>
        <label>Total count<input name="stock_count" type="number" min="0" step="1"></label>
        <label>Price paid<input name="purchase_price" type="number" min="0" step="0.01"></label>
        <p class="muted" data-unified-detail></p>
        <button class="btn fox" type="submit">Add Preset</button>
      </form>
    </article>
  `;
}

async function savePreset(event) {
  event.preventDefault();
  const ctx = await loadOwnerContext();
  if (!ctx) return toast("Only the account owner can add inventory presets.");
  const form = event.currentTarget;
  const item = selectedItem(form);
  if (!item) return toast("Choose a preset first.");
  const cleanCount = ["cloth", "cloth_insert", "underpad"].includes(item.item_type) ? Number(form.elements.stock_count.value || item.stock_count || 0) : 0;
  const { error } = await supabase.from("diapers").insert({
    household_id: ctx.household.id,
    brand: item.brand,
    style: item.style,
    item_type: item.item_type,
    size: item.size,
    stock_count: Number(form.elements.stock_count.value || item.stock_count || 0),
    clean_count: cleanCount,
    purchase_price: Number(form.elements.purchase_price.value || 0)
  });
  if (error) return toast(`Preset could not save: ${error.message}`);
  toast(`Added ${item.brand} ${item.style}.`);
  setTimeout(() => location.reload(), 700);
}

function buildCatalogFromOldForms() {
  const items = [
    ...collectFromMainForm(document.getElementById("presetCatalogForm") || document.createElement("form")),
    ...collectFromExtraForm(document.getElementById("extraPresetForm") || document.createElement("form"))
  ];
  catalog = uniqueItems(items);
}

async function injectUnifiedPreset() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  if (title !== "Inventory") return;
  const ctx = await loadOwnerContext();
  if (!ctx) return;
  if (!ready) {
    buildCatalogFromOldForms();
    ready = catalog.length > 0;
  }
  removeOldPresetCards();
  if (!ready || document.getElementById("unifiedPresetCard")) return;
  const view = document.getElementById("view");
  const starter = document.getElementById("starterImportBtn")?.closest(".card");
  const anchor = starter || view?.querySelector(".card");
  if (!anchor) return;
  anchor.insertAdjacentHTML("afterend", cardHtml());
  const form = document.getElementById("unifiedPresetForm");
  refreshProducts(form);
  form.elements.brand.addEventListener("change", () => refreshProducts(form));
  form.elements.product.addEventListener("change", () => refreshSizes(form));
  form.elements.size.addEventListener("change", () => refreshPackages(form));
  form.elements.package.addEventListener("change", () => refreshDetails(form));
  form.addEventListener("submit", savePreset);
}

new MutationObserver(injectUnifiedPreset).observe(document.getElementById("app"), { childList: true, subtree: true });
setTimeout(injectUnifiedPreset, 0);
