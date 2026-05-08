import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const itemTypes = {
  disposable: "Disposable diaper",
  disposable_insert: "Disposable insert",
  cloth: "Cloth diaper",
  cloth_insert: "Cloth insert",
  underpad: "Underpad"
};

const presets = [
  ["disposable", "NorthShore", "MegaMax", "Medium", 10, 0],
  ["disposable", "NorthShore", "Supreme", "Medium", 15, 0],
  ["disposable", "NorthShore", "GoSupreme Pull-On", "Medium", 14, 0],
  ["disposable", "InControl", "BeDry", "Large", 12, 0],
  ["disposable", "InControl", "BeDry Night", "Large", 12, 0],
  ["disposable", "InControl", "BeDry EliteCare Premium Briefs", "Case", 2, 0],
  ["disposable", "InControl", "Active Air Incontinence Briefs", "Case", 1, 0],
  ["disposable", "Tykables", "Overnights", "Medium", 10, 0],
  ["disposable", "Tykables", "Little Builders", "Medium", 10, 0],
  ["disposable", "ABU", "LittlePawz", "Medium", 10, 0],
  ["disposable", "ABU", "BeddyByes", "Medium / case", 80, 225],
  ["disposable", "Potty Training Dropouts", "Training Briefs", "Medium", 10, 0],
  ["disposable", "Little North Woods", "Training Diaper", "Medium", 10, 0],
  ["disposable_insert", "NorthShore", "Booster Pad", "Regular", 30, 0],
  ["disposable_insert", "InControl", "Booster Pad", "Regular", 30, 0],
  ["disposable_insert", "ABU", "PowerUps Booster Pads", "Regular", 20, 0],
  ["cloth", "ThreadedArmor", "Adult Cotton Fitted Snap Diaper", "Medium", 1, 0],
  ["cloth", "ThreadedArmor", "Harmony Nighttime Fitted Cloth Diaper", "Medium", 1, 0],
  ["cloth", "ThreadedArmor", "Protective Briefs with Snaps", "White / Medium", 1, 64.99],
  ["cloth", "ThreadedArmor", "Limited Release: Grimoire Protective Brief", "Medium", 1, 69.99],
  ["cloth", "ThreadedArmor", "Limited Release: Sweater Weather Protective Brief", "Medium", 1, 69.99],
  ["cloth", "EcoAble", "Pocket Cloth Diaper 2.0 Day & Night Set", "Small / Wolf", 1, 62.99],
  ["cloth", "LeakMaster", "Adult All-In-One Cloth Diaper", "Medium", 1, 36.51],
  ["cloth_insert", "ThreadedArmor", "Adult Diaper Step-up Insert", "S/M", 1, 14.95],
  ["cloth_insert", "ThreadedArmor", "Adult Microfiber Booster Pads", "4 pack", 4, 0],
  ["cloth_insert", "InControl", "Contour Washable Boosters", "2 pack", 2, 0],
  ["cloth_insert", "InControl", "Bamboo Contour Booster Pads", "3 pack", 3, 0],
  ["cloth_insert", "EcoAble", "Cloth Diaper Inserts", "Large", 4, 0],
  ["cloth_insert", "Unknown", "Adult Cloth Diaper Inserts", "Birdseye / Large / 4 pack", 4, 11.88],
  ["underpad", "NorthShore", "Champion XD Washable Underpad", "Large 33x35 in.", 1, 0],
  ["underpad", "ThreadedArmor", "Heavy-Duty Mesh Laundry Bag", "Cloth diaper laundry", 1, 9.95]
].map(([item_type, brand, style, size, stock_count, purchase_price]) => ({
  item_type,
  brand,
  style,
  size,
  stock_count,
  clean_count: ["cloth", "cloth_insert", "underpad"].includes(item_type) ? stock_count : 0,
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
  if (!member || !household) return null;
  const isOwner = member.role === "owner" || household.owner_id === session.user.id;
  return isOwner ? { session, member, household } : null;
}

function groupedOptions(type) {
  return presets
    .filter(item => item.item_type === type)
    .map(item => `<option value="${presets.indexOf(item)}">${esc(item.brand)} - ${esc(item.style)}</option>`)
    .join("");
}

function selectedPreset(form) {
  return presets[Number(form.elements.preset.value)] || presets[0];
}

function fillPresetFields(form) {
  const item = selectedPreset(form);
  form.elements.size.value = item.size || "";
  form.elements.stock_count.value = item.stock_count || 1;
  form.elements.clean_count.value = item.clean_count || 0;
  form.elements.purchase_price.value = Number(item.purchase_price || 0).toFixed(2);
  form.querySelector("[data-preset-detail]").textContent = `${itemTypes[item.item_type]}: ${item.brand} ${item.style}`;
}

function refreshPresetOptions(form) {
  const type = form.elements.item_type.value;
  form.elements.preset.innerHTML = groupedOptions(type);
  fillPresetFields(form);
}

function catalogCard() {
  const firstType = "disposable";
  return `
    <article class="card" id="presetCatalogCard" style="margin-top:14px">
      <h3>Quick Add Preset</h3>
      <p>Pick a common disposable, cloth diaper, insert, or underpad and adjust only the count, size, and price.</p>
      <form id="presetCatalogForm" class="form-grid" style="margin-top:12px">
        <label>Type
          <select name="item_type">
            ${Object.entries(itemTypes).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
          </select>
        </label>
        <label>Preset
          <select name="preset">${groupedOptions(firstType)}</select>
        </label>
        <label>Size or pack
          <input name="size" type="text">
        </label>
        <label>Total count
          <input name="stock_count" type="number" min="0" step="1">
        </label>
        <label>Clean count
          <input name="clean_count" type="number" min="0" step="1">
        </label>
        <label>Price paid
          <input name="purchase_price" type="number" min="0" step="0.01">
        </label>
        <p class="muted" data-preset-detail></p>
        <button class="btn fox" type="submit">Add Preset</button>
      </form>
    </article>
  `;
}

async function savePreset(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const ctx = await loadOwnerContext();
  if (!ctx) return toast("Only the account owner can add inventory presets.");
  const item = selectedPreset(form);
  const row = {
    household_id: ctx.household.id,
    brand: item.brand,
    style: item.style,
    item_type: item.item_type,
    size: form.elements.size.value.trim() || item.size,
    stock_count: Number(form.elements.stock_count.value || item.stock_count || 0),
    clean_count: Number(form.elements.clean_count.value || 0),
    purchase_price: Number(form.elements.purchase_price.value || 0)
  };
  if (!["cloth", "cloth_insert", "underpad"].includes(row.item_type)) row.clean_count = 0;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Adding...";
  const { error } = await supabase.from("diapers").insert(row);
  if (error) {
    button.disabled = false;
    button.textContent = "Add Preset";
    return toast(`Preset could not save: ${error.message}`);
  }
  toast(`Added ${row.brand} ${row.style}.`);
  setTimeout(() => location.reload(), 700);
}

async function injectCatalog() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  if (title !== "Inventory" || document.getElementById("presetCatalogCard")) return;
  const ctx = await loadOwnerContext();
  if (!ctx) return;
  const view = document.getElementById("view");
  const starter = document.getElementById("starterImportBtn")?.closest(".card");
  const firstCard = view?.querySelector(".card");
  const anchor = starter || firstCard;
  if (!anchor) return;
  anchor.insertAdjacentHTML("afterend", catalogCard());
  const form = document.getElementById("presetCatalogForm");
  refreshPresetOptions(form);
  form.elements.item_type.addEventListener("change", () => refreshPresetOptions(form));
  form.elements.preset.addEventListener("change", () => fillPresetFields(form));
  form.addEventListener("submit", savePreset);
}

new MutationObserver(injectCatalog).observe(document.getElementById("app"), { childList: true, subtree: true });
injectCatalog();
