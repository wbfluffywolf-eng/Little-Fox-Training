import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const typeLabels = {
  disposable: "Disposable diaper",
  disposable_insert: "Disposable insert",
  cloth: "Cloth diaper",
  cloth_insert: "Cloth insert",
  underpad: "Underpad"
};

const catalog = [
  ["disposable", "NorthShore", "MegaMax", "Medium / bag", 10, 0],
  ["disposable", "NorthShore", "Supreme", "Medium / bag", 15, 0],
  ["disposable", "NorthShore", "GoSupreme Pull-On", "Medium / bag", 14, 0],
  ["disposable", "InControl", "BeDry EliteCare Premium Incontinence Briefs", "Small / case of 36", 36, 0],
  ["disposable", "InControl", "BeDry EliteCare Premium Incontinence Briefs", "Medium / case of 36", 36, 0],
  ["disposable", "InControl", "BeDry EliteCare Premium Incontinence Briefs", "Large / case of 36", 36, 0],
  ["disposable", "InControl", "BeDry Premium Incontinence Briefs", "Medium / case of 48", 48, 0],
  ["disposable", "InControl", "BeDry Night Premium Incontinence Briefs", "Medium / case of 36", 36, 0],
  ["disposable", "InControl", "Active Air Incontinence Briefs", "Medium / case of 60", 60, 0],
  ["disposable", "Tykables", "Overnights", "Medium / bag", 10, 0],
  ["disposable", "Tykables", "Little Builders", "Medium / bag", 10, 0],
  ["disposable", "ABU", "LittlePawz", "Medium / bag", 10, 0],
  ["disposable", "ABU", "BeddyByes", "Medium / case", 80, 225],
  ["disposable", "Potty Training Dropouts", "BeddyByes", "Medium / case of 40", 40, 225],
  ["disposable", "Little Northwood", "Little Quest", "Medium / sample", 2, 0],
  ["disposable", "LNGU", "Honey Tales", "Medium / pack of 10", 10, 31.99],
  ["disposable", "LNGU", "Big Ears Baby", "Medium / case of 40", 40, 0],
  ["disposable", "LNGU", "Dragoonz", "Medium / case of 40", 40, 0],
  ["disposable_insert", "NorthShore", "Booster Pad", "Regular / pack", 30, 0],
  ["disposable_insert", "ABU", "PowerUps Booster Pads", "Regular / pack", 20, 0],
  ["disposable_insert", "InControl", "Booster Pads - Unscented", "One Size / case of 180", 180, 0],
  ["cloth", "ThreadedArmor", "Adult Cotton Fitted Snap Diaper", "Medium", 1, 0],
  ["cloth", "ThreadedArmor", "Harmony Nighttime Fitted Cloth Diaper", "Medium", 1, 0],
  ["cloth", "ThreadedArmor", "Protective Briefs with Snaps", "White / Medium", 1, 64.99],
  ["cloth", "ThreadedArmor", "Limited Release: Grimoire Protective Brief", "Medium", 1, 69.99],
  ["cloth", "ThreadedArmor", "Limited Release: Sweater Weather Protective Brief", "Medium", 1, 69.99],
  ["cloth", "EcoAble", "Pocket Cloth Diaper 2.0 Day & Night Set", "Small / Wolf", 1, 62.99],
  ["cloth", "LeakMaster", "Adult All-In-One Cloth Diaper", "Medium", 1, 36.51],
  ["cloth", "InControl", "Harmony Nighttime Fitted Cloth Diaper", "Medium", 1, 0],
  ["cloth_insert", "ThreadedArmor", "Adult Diaper Step-up Insert", "S/M", 1, 14.95],
  ["cloth_insert", "ThreadedArmor", "Adult Microfiber Booster Pads", "4 pack", 4, 0],
  ["cloth_insert", "EcoAble", "Cloth Diaper Inserts", "Large / 4 pack", 4, 0],
  ["cloth_insert", "InControl", "Bamboo Contour Booster Pads", "3 pack", 3, 0],
  ["cloth_insert", "InControl", "Adult Microfiber Booster Pads", "4 pack", 4, 0],
  ["underpad", "NorthShore", "Champion XD Washable Underpad", "Large 33x35 in.", 1, 0],
  ["underpad", "ThreadedArmor", "Heavy-Duty Mesh Laundry Bag", "Cloth diaper laundry", 1, 9.95]
].map(([item_type, brand, style, size, stock_count, purchase_price]) => ({
  item_type,
  brand,
  style,
  size,
  stock_count,
  purchase_price
}));

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

function optionList(values) {
  return values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
}

function packageLabel(item) {
  const count = Number(item.stock_count || 1);
  const lower = `${item.size} ${item.style}`.toLowerCase();
  if (lower.includes("sample")) return `Sample / ${count}`;
  if (lower.includes("case") || count >= 30) return `Case / ${count}`;
  if (lower.includes("bag") || lower.includes("pack") || count > 1) return `Bag or pack / ${count}`;
  return "Single item / 1";
}

function matches(form, item) {
  return item.brand === form.elements.brand.value &&
    `${typeLabels[item.item_type]}: ${item.style}` === form.elements.product.value &&
    item.size === form.elements.size.value &&
    packageLabel(item) === form.elements.package.value;
}

function selectedItem(form) {
  return catalog.find(item => matches(form, item)) || catalog[0];
}

function refreshProducts(form) {
  const products = [...new Set(catalog
    .filter(item => item.brand === form.elements.brand.value)
    .map(item => `${typeLabels[item.item_type]}: ${item.style}`))];
  form.elements.product.innerHTML = optionList(products);
  refreshSizes(form);
}

function refreshSizes(form) {
  const sizes = [...new Set(catalog
    .filter(item => item.brand === form.elements.brand.value && `${typeLabels[item.item_type]}: ${item.style}` === form.elements.product.value)
    .map(item => item.size))];
  form.elements.size.innerHTML = optionList(sizes);
  refreshPackages(form);
}

function refreshPackages(form) {
  const packages = [...new Set(catalog
    .filter(item =>
      item.brand === form.elements.brand.value &&
      `${typeLabels[item.item_type]}: ${item.style}` === form.elements.product.value &&
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
    ? `<strong>${esc(item.brand)} ${esc(item.style)}</strong><br>${esc(typeLabels[item.item_type])} - ${esc(item.size)} - ${esc(packageLabel(item))}`
    : "";
}

function cardHtml() {
  const brands = [...new Set(catalog.map(item => item.brand))].sort((a, b) => a.localeCompare(b));
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
  const stockCount = Number(form.elements.stock_count.value || item.stock_count || 0);
  const cleanCount = ["cloth", "cloth_insert", "underpad"].includes(item.item_type) ? stockCount : 0;
  const { error } = await supabase.from("diapers").insert({
    household_id: ctx.household.id,
    brand: item.brand,
    style: item.style,
    item_type: item.item_type,
    size: item.size,
    stock_count: stockCount,
    clean_count: cleanCount,
    purchase_price: Number(form.elements.purchase_price.value || 0)
  });
  if (error) return toast(`Preset could not save: ${error.message}`);
  toast(`Added ${item.brand} ${item.style}.`);
  setTimeout(() => location.reload(), 700);
}

async function injectUnifiedPreset() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  if (title !== "Inventory" || document.getElementById("unifiedPresetCard")) return;
  const ctx = await loadOwnerContext();
  if (!ctx) return;
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
