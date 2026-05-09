import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const itemTypes = {
  disposable: "Disposable diapers",
  disposable_insert: "Disposable inserts",
  cloth: "Cloth diapers",
  cloth_insert: "Cloth inserts",
  underpad: "Underpads"
};

const itemTypeLabels = {
  disposable: "Disposable diaper",
  disposable_insert: "Disposable insert",
  cloth: "Cloth diaper",
  cloth_insert: "Cloth insert",
  underpad: "Underpad"
};

const presetCatalog = [
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

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2600);
}

async function loadInventoryContext() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data: memberships, error: membershipError } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", session.user.id)
    .eq("status", "active");
  if (membershipError) throw membershipError;

  const currentViewHasSuggestForm = Boolean(document.getElementById("suggestForm") || document.getElementById("inventorySuggestForm"));
  const sharedSuggestMember = memberships?.find(row => row.can_suggest_diaper === true && row.households);
  const ownerMember = memberships?.find(row => row.role === "owner" || row.households?.owner_id === session.user.id);
  const member = (currentViewHasSuggestForm && sharedSuggestMember) || ownerMember || memberships?.[0];
  const household = member?.households;
  if (!member || !household) return null;

  const canView = member.role === "owner" || member.can_view_inventory === true || household.owner_id === session.user.id;
  if (!canView) return null;

  const [diapers, logs] = await Promise.all([
    supabase.from("diapers").select("*").eq("household_id", household.id).order("created_at", { ascending: false }),
    supabase.from("logs").select("diaper_id, insert_ids, changed_at, happened_at").eq("household_id", household.id)
  ]);
  if (diapers.error) throw diapers.error;

  return {
    household,
    isOwner: member.role === "owner" || household.owner_id === session.user.id,
    canSuggest: member.can_suggest_diaper === true && member.role !== "owner" && household.owner_id !== session.user.id,
    userId: session.user.id,
    diapers: diapers.data || [],
    logs: logs.data || []
  };
}

function statCard(title, value, sub) {
  return `<article class="card"><h3>${esc(title)}</h3><h2>${esc(value)}</h2><p>${esc(sub)}</p></article>`;
}

function cleanCount(item, logs) {
  if (!["cloth", "cloth_insert", "underpad"].includes(item.item_type)) return Number(item.stock_count || 0);
  return Math.max(0, Number(item.clean_count ?? item.stock_count ?? 0) - dirtyCount(item.id, logs));
}

function dirtyCount(itemId, logs) {
  const cutoff = Date.now() - 48 * 3600000;
  return logs.filter(log => {
    const when = new Date(log.changed_at || log.happened_at).getTime();
    const inserts = Array.isArray(log.insert_ids) ? log.insert_ids : [];
    return when >= cutoff && (log.diaper_id === itemId || inserts.includes(itemId));
  }).length;
}

function itemCard(item, logs, isOwner) {
  const dirty = dirtyCount(item.id, logs);
  const clean = cleanCount(item, logs);
  return `
    <div class="item">
      <div class="item-head">
        <div>
          <h4>${esc(item.brand)} ${esc(item.style)}</h4>
          <p>${esc(item.size || "No size")} - ${esc(itemTypeLabels[item.item_type] || item.item_type || "Inventory item")}</p>
        </div>
        <strong>${Number(item.stock_count || 0)}</strong>
      </div>
      <div class="pill-row">
        <span class="pill">${money(item.purchase_price)}</span>
        ${["cloth", "cloth_insert", "underpad"].includes(item.item_type) ? `<span class="pill owner">${clean} clean</span><span class="pill alert">${dirty} dirty</span>` : ""}
        ${isOwner ? `<button class="btn secondary" type="button" data-inventory-delete="${esc(item.id)}">Delete</button>` : ""}
      </div>
    </div>
  `;
}

function inventoryGroup(type, items, logs, isOwner) {
  return `
    <article class="card">
      <h3>${esc(itemTypes[type] || type)}</h3>
      <div class="list" style="margin-top:12px">
        ${items.map(item => itemCard(item, logs, isOwner)).join("") || `<div class="empty">No ${esc((itemTypes[type] || type).toLowerCase())} saved.</div>`}
      </div>
    </article>
  `;
}

function presetPackage(item) {
  const count = Number(item.stock_count || 1);
  const lower = `${item.size} ${item.style}`.toLowerCase();
  if (lower.includes("sample")) return `Sample / ${count}`;
  if (lower.includes("case") || count >= 30) return `Case / ${count}`;
  if (lower.includes("bag") || lower.includes("pack") || count > 1) return `Bag or pack / ${count}`;
  return "Single item / 1";
}

function selectOptions(values) {
  return values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
}

function manualForm() {
  return `
    <article class="card">
      <h3>Manual Add</h3>
      <form id="inventoryManualForm" class="grid" style="margin-top:12px">
        <div class="form-grid">
          <label>Brand<input name="brand" required></label>
          <label>Style<input name="style" required></label>
          <label>Size<input name="size"></label>
          <label>Type<select name="item_type">${Object.entries(itemTypeLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
          <label>Total count<input name="stock_count" type="number" min="0" value="1"></label>
          <label>Clean count<input name="clean_count" type="number" min="0" value="1"></label>
          <label>Purchase price<input name="purchase_price" type="number" min="0" step="0.01" value="0"></label>
        </div>
        <button class="btn fox" type="submit">Save Item</button>
      </form>
    </article>
  `;
}

function presetForm() {
  const brands = [...new Set(presetCatalog.map(item => item.brand))].sort((a, b) => a.localeCompare(b));
  return `
    <article class="card">
      <h3>Quick Add</h3>
      <form id="inventoryPresetForm" class="grid" style="margin-top:12px">
        <div class="form-grid">
          <label>Brand<select name="brand">${selectOptions(brands)}</select></label>
          <label>Product<select name="product"></select></label>
          <label>Size<select name="size"></select></label>
          <label>Case or bag<select name="package"></select></label>
          <label>Total count<input name="stock_count" type="number" min="0" step="1"></label>
          <label>Price paid<input name="purchase_price" type="number" min="0" step="0.01"></label>
        </div>
        <p class="muted" data-preset-detail></p>
        <button class="btn fox" type="submit">Add Preset</button>
      </form>
    </article>
  `;
}

function suggestionForm(ctx) {
  const diaperOptions = ctx.diapers
    .filter(item => item.item_type === "disposable" || item.item_type === "cloth")
    .map(item => `<option value="${esc(item.id)}">${esc(item.brand)} ${esc(item.style)}${item.size ? ` (${esc(item.size)})` : ""}</option>`)
    .join("");

  return `
    <article class="card">
      <h3>Suggest a Diaper</h3>
      <p>Send a diaper suggestion to this tracker owner.</p>
      <form id="inventorySuggestForm" class="grid" style="margin-top:12px">
        <label>Diaper
          <select name="diaper_id" required>
            ${diaperOptions}
          </select>
        </label>
        <label>Message
          <textarea name="note" rows="3" placeholder="Optional note"></textarea>
        </label>
        <button class="btn fox" type="submit" ${diaperOptions ? "" : "disabled"}>Send Suggestion</button>
      </form>
    </article>
  `;
}

function renderInventory(ctx) {
  const grouped = Object.fromEntries(Object.keys(itemTypes).map(type => [type, ctx.diapers.filter(item => item.item_type === type)]));
  const disposableCount = [...grouped.disposable, ...grouped.disposable_insert].reduce((sum, item) => sum + Number(item.stock_count || 0), 0);
  const clothClean = [...grouped.cloth, ...grouped.cloth_insert, ...grouped.underpad].reduce((sum, item) => sum + cleanCount(item, ctx.logs), 0);
  const lowStock = ctx.diapers.filter(item => Number(item.stock_count || 0) <= 5).length;

  return `
    <div class="grid three">
      ${statCard("Saved Items", ctx.diapers.length, "inventory records")}
      ${statCard("Disposable Stock", disposableCount, "diapers and inserts")}
      ${statCard("Clean Cloth", clothClean, `${lowStock} low stock items`)}
    </div>
    ${ctx.isOwner ? `<section class="grid two" style="margin-top:14px">${presetForm()}${manualForm()}</section>` : ""}
    ${ctx.canSuggest ? `<section class="grid two" style="margin-top:14px">${suggestionForm(ctx)}</section>` : ""}
    <section class="grid two" style="margin-top:14px">
      ${Object.keys(itemTypes).map(type => inventoryGroup(type, grouped[type], ctx.logs, ctx.isOwner)).join("")}
    </section>
  `;
}

function configurePresetForm(form) {
  function productValue(item) {
    return `${itemTypeLabels[item.item_type]}: ${item.style}`;
  }

  function selectedItem() {
    return presetCatalog.find(item =>
      item.brand === form.elements.brand.value &&
      productValue(item) === form.elements.product.value &&
      item.size === form.elements.size.value &&
      presetPackage(item) === form.elements.package.value
    ) || presetCatalog[0];
  }

  function refreshProducts() {
    const products = [...new Set(presetCatalog.filter(item => item.brand === form.elements.brand.value).map(productValue))];
    form.elements.product.innerHTML = selectOptions(products);
    refreshSizes();
  }

  function refreshSizes() {
    const sizes = [...new Set(presetCatalog
      .filter(item => item.brand === form.elements.brand.value && productValue(item) === form.elements.product.value)
      .map(item => item.size))];
    form.elements.size.innerHTML = selectOptions(sizes);
    refreshPackages();
  }

  function refreshPackages() {
    const packages = [...new Set(presetCatalog
      .filter(item => item.brand === form.elements.brand.value && productValue(item) === form.elements.product.value && item.size === form.elements.size.value)
      .map(presetPackage))];
    form.elements.package.innerHTML = selectOptions(packages);
    refreshDetail();
  }

  function refreshDetail() {
    const item = selectedItem();
    form.elements.stock_count.value = item.stock_count || 1;
    form.elements.purchase_price.value = Number(item.purchase_price || 0).toFixed(2);
    form.querySelector("[data-preset-detail]").innerHTML = `<strong>${esc(item.brand)} ${esc(item.style)}</strong><br>${esc(itemTypeLabels[item.item_type])} - ${esc(item.size)} - ${esc(presetPackage(item))}`;
  }

  form.elements.brand.addEventListener("change", refreshProducts);
  form.elements.product.addEventListener("change", refreshSizes);
  form.elements.size.addEventListener("change", refreshPackages);
  form.elements.package.addEventListener("change", refreshDetail);
  refreshProducts();

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const ctx = await loadInventoryContext();
    if (!ctx?.isOwner) return toast("Only the account owner can add inventory.");
    const item = selectedItem();
    const stockCount = Number(form.elements.stock_count.value || item.stock_count || 0);
    const cleanCount = ["cloth", "cloth_insert", "underpad"].includes(item.item_type) ? stockCount : 0;
    const { error } = await supabase.from("diapers").insert({
      household_id: ctx.household.id,
      brand: item.brand,
      style: item.style,
      size: item.size,
      item_type: item.item_type,
      stock_count: stockCount,
      clean_count: cleanCount,
      purchase_price: Number(form.elements.purchase_price.value || 0)
    });
    if (error) return toast(error.message);
    toast("Preset added.");
    await rebuildInventory(true);
  });
}

function configureManualForm(form) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const ctx = await loadInventoryContext();
    if (!ctx?.isOwner) return toast("Only the account owner can add inventory.");
    const data = new FormData(form);
    const stockCount = Number(data.get("stock_count") || 0);
    const itemType = data.get("item_type");
    const cleanCount = ["cloth", "cloth_insert", "underpad"].includes(itemType) ? Number(data.get("clean_count") || stockCount) : 0;
    const { error } = await supabase.from("diapers").insert({
      household_id: ctx.household.id,
      brand: data.get("brand").trim(),
      style: data.get("style").trim(),
      size: data.get("size").trim(),
      item_type: itemType,
      stock_count: stockCount,
      clean_count: cleanCount,
      purchase_price: Number(data.get("purchase_price") || 0)
    });
    if (error) return toast(error.message);
    toast("Inventory item saved.");
    await rebuildInventory(true);
  });
}

function configureSuggestionForm(form) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const ctx = await loadInventoryContext();
    if (!ctx?.canSuggest) return toast("This tracker does not allow diaper suggestions.");
    const data = new FormData(form);
    const diaperId = data.get("diaper_id");
    if (!diaperId) return toast("Pick a diaper first.");
    const { error } = await supabase.from("diaper_suggestions").insert({
      household_id: ctx.household.id,
      diaper_id: diaperId,
      suggested_by: ctx.userId,
      note: String(data.get("note") || "").trim()
    });
    if (error) return toast(`Suggestion could not send: ${error.message}`);
    form.reset();
    toast("Suggestion sent.");
  });
}

async function deleteItem(id) {
  const { error } = await supabase.from("diapers").delete().eq("id", id);
  if (error) return toast(error.message);
  toast("Inventory item deleted.");
  await rebuildInventory(true);
}

async function rebuildInventory(force = false) {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (title !== "Inventory" || !view) return;
  if (view.dataset.inventoryRebuilt === "true" && !force) return;

  const ctx = await loadInventoryContext();
  if (!ctx) return;

  view.dataset.inventoryRebuilt = "true";
  view.innerHTML = renderInventory(ctx);
  const preset = document.getElementById("inventoryPresetForm");
  if (preset) configurePresetForm(preset);
  const manual = document.getElementById("inventoryManualForm");
  if (manual) configureManualForm(manual);
  const suggestion = document.getElementById("inventorySuggestForm");
  if (suggestion) configureSuggestionForm(suggestion);
  view.querySelectorAll("[data-inventory-delete]").forEach(button => {
    button.addEventListener("click", () => deleteItem(button.dataset.inventoryDelete));
  });
}

new MutationObserver(() => rebuildInventory()).observe(document.getElementById("app"), { childList: true, subtree: true });
setTimeout(() => rebuildInventory(), 0);
