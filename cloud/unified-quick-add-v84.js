import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";
import { updatedQuickAddHeaders, updatedQuickAddRows } from "./updated-quick-add-catalog-v84.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const itemTypeLabels = {
  disposable: "Disposable diaper",
  disposable_insert: "Disposable insert",
  cloth: "Cloth diaper",
  cloth_insert: "Cloth insert",
  underpad: "Underpad"
};

let catalogPromise;
let catalog = [];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function numeric(value) {
  const parsed = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function priceValue(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  if (!/^(from\s*)?\$?\s*\d/i.test(text)) return 0;
  return numeric(text);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        value += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(value);
      value = "";
    } else if (ch === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (ch !== "\r") value += ch;
  }
  row.push(value);
  rows.push(row);
  const headers = rows.shift() || [];
  return rows.filter(csvRow => csvRow.some(cell => cell.trim())).map(csvRow =>
    Object.fromEntries(headers.map((header, index) => [header, csvRow[index] || ""]))
  );
}

function splitList(value) {
  return String(value || "").split(/[;|,]/).map(item => item.trim()).filter(Boolean);
}

function itemType(row) {
  const lower = String(row.product_type || row.category || row.type_style || "").toLowerCase();
  if (lower.includes("cloth") && (lower.includes("insert") || lower.includes("booster"))) return "cloth_insert";
  if (lower.includes("insert") || lower.includes("booster")) return "disposable_insert";
  if (lower.includes("underpad")) return "underpad";
  if (lower.includes("cloth") || lower.includes("brief") || lower.includes("diaper")) return "cloth";
  return "disposable";
}

function csvPresets(row) {
  const brand = row.brand?.trim();
  const style = row.product_name?.trim();
  if (!brand || !style) return [];
  const type = itemType(row);
  const sizes = row.size?.trim() ? [row.size.trim()] : splitList(row.sizes || "One size");
  const colors = splitList(row.colors_or_prints || row.colors || row.prints);
  const styles = colors.length ? colors.map(color => `${style} - ${color.replace(/\s*\((sold out|unavailable)\)/ig, "")}`) : [style];
  const bagCount = numeric(row.diapers_or_inserts_per_bag);
  const bagPrice = priceValue(row.price_per_bag_or_pack_usd);
  const unitPrice = priceValue(row.unit_or_sample_price_usd) || priceValue(row.price_usd);
  const caseCounts = splitList(row.diapers_or_inserts_per_case).map(numeric).filter(Boolean);
  const baseCasePrice = priceValue(row.price_per_case_usd);
  const out = [];
  styles.forEach(styleName => sizes.forEach(size => {
    if (bagCount) out.push({ item_type: type, brand, style: styleName, size: `${size} / bag or pack of ${bagCount}`, stock_count: bagCount, purchase_price: bagPrice });
    caseCounts.forEach(count => {
      const price = count === 40 ? priceValue(row.price_per_40_case_usd) || baseCasePrice : count === 80 ? priceValue(row.price_per_80_case_usd) || baseCasePrice : baseCasePrice;
      out.push({ item_type: type, brand, style: styleName, size: `${size} / case of ${count}`, stock_count: count, purchase_price: price });
    });
    if (unitPrice) out.push({ item_type: type, brand, style: styleName, size, stock_count: 1, purchase_price: unitPrice });
  }));
  return out;
}

async function loadCatalog() {
  if (catalogPromise) return catalogPromise;
  catalogPromise = Promise.resolve().then(() => {
    const seen = new Set();
    const rows = updatedQuickAddRows.map(row => Object.fromEntries(updatedQuickAddHeaders.map((header, index) => [header, row[index] || ""])));
    catalog = rows.flatMap(csvPresets)
      .filter(item => {
        const key = `${item.item_type}|${item.brand}|${item.style}|${item.size}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => `${a.brand} ${a.style} ${a.size}`.localeCompare(`${b.brand} ${b.style} ${b.size}`));
    return catalog;
  });
  return catalogPromise;
}

function options(values) {
  return values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
}

function productValue(item) {
  return `${itemTypeLabels[item.item_type] || item.item_type}: ${item.style}`;
}

function packageValue(item) {
  const count = Number(item.stock_count || 1);
  const lower = `${item.size} ${item.style}`.toLowerCase();
  if (lower.includes("case")) return `Case / ${count}`;
  if (lower.includes("bag") || lower.includes("pack") || count > 1) return `Bag or pack / ${count}`;
  return "Single item / 1";
}

function selectedItem(form) {
  return catalog.find(item =>
    item.brand === form.elements.brand.value &&
    productValue(item) === form.elements.product.value &&
    item.size === form.elements.size.value &&
    packageValue(item) === form.elements.package.value
  ) || catalog[0];
}

async function ownerHousehold() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from("household_members")
    .select("role, households(id, owner_id)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw error;
  return data?.find(row => row.role === "owner" || row.households?.owner_id === user.id)?.households || null;
}

function configure(form) {
  if (!form || form.dataset.unifiedQuickAdd === "true") return;
  form.dataset.unifiedQuickAdd = "true";
  form.querySelector("button[type='submit']").textContent = "Add Quick Item";

  function refreshProducts() {
    const products = [...new Set(catalog.filter(item => item.brand === form.elements.brand.value).map(productValue))];
    form.elements.product.innerHTML = options(products);
    refreshSizes();
  }

  function refreshSizes() {
    const sizes = [...new Set(catalog.filter(item => item.brand === form.elements.brand.value && productValue(item) === form.elements.product.value).map(item => item.size))];
    form.elements.size.innerHTML = options(sizes);
    refreshPackages();
  }

  function refreshPackages() {
    const packages = [...new Set(catalog.filter(item => item.brand === form.elements.brand.value && productValue(item) === form.elements.product.value && item.size === form.elements.size.value).map(packageValue))];
    form.elements.package.innerHTML = options(packages);
    refreshDetail();
  }

  function refreshDetail() {
    const item = selectedItem(form);
    if (!item) return;
    form.elements.stock_count.value = item.stock_count || 1;
    form.elements.purchase_price.value = Number(item.purchase_price || 0).toFixed(2);
    form.querySelector("[data-preset-detail]").innerHTML = `<strong>${esc(item.brand)} ${esc(item.style)}</strong><br>${esc(itemTypeLabels[item.item_type] || item.item_type)} - ${esc(item.size)} - ${esc(packageValue(item))}`;
  }

  form.elements.brand.addEventListener("change", refreshProducts);
  form.elements.product.addEventListener("change", refreshSizes);
  form.elements.size.addEventListener("change", refreshPackages);
  form.elements.package.addEventListener("change", refreshDetail);

  form.addEventListener("submit", async event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const item = selectedItem(form);
    const household = await ownerHousehold();
    if (!item || !household) return toast("Only the account owner can add inventory.");
    const stockCount = Number(form.elements.stock_count.value || item.stock_count || 0);
    const cleanCount = ["cloth", "cloth_insert", "underpad"].includes(item.item_type) ? stockCount : 0;
    const { error } = await supabase.from("diapers").insert({
      household_id: household.id,
      brand: item.brand,
      style: item.style,
      size: item.size,
      item_type: item.item_type,
      stock_count: stockCount,
      clean_count: cleanCount,
      purchase_price: Number(form.elements.purchase_price.value || 0)
    });
    if (error) return toast(error.message);
    toast("Quick item added.");
    document.getElementById("view")?.removeAttribute("data-inventory-rebuilt");
    document.querySelector('[data-tab="inventory"]')?.click();
  }, true);

  form.elements.brand.innerHTML = options([...new Set(catalog.map(item => item.brand))].sort((a, b) => a.localeCompare(b)));
  refreshProducts();
}

async function applyUnifiedQuickAdd() {
  document.getElementById("threadedArmorPrintCard")?.remove();
  document.getElementById("abuQuickAddCard")?.remove();
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const form = document.getElementById("inventoryPresetForm");
  if (title !== "Inventory" || !form) return;
  await loadCatalog();
  configure(form);
}

document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="inventory"]')) setTimeout(() => applyUnifiedQuickAdd().catch(() => {}), 250);
});

new MutationObserver(() => applyUnifiedQuickAdd().catch(() => {})).observe(document.body, { childList: true, subtree: true });
[0, 600, 1500, 3000].forEach(delay => setTimeout(() => applyUnifiedQuickAdd().catch(() => {}), delay));
