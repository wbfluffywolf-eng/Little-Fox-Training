import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const presets = [
  ["Little Northwood", "Little Quest", "M", 1, "https://littlenorthwood.com/products/little-quest", "https://d2j6dbq0eux0bg.cloudfront.net/images/131538540/products/822455433/5724916495.png", "Sold out on product page. Pack and case count not listed."],
  ["Little Northwood", "Little Quest", "L", 1, "https://littlenorthwood.com/products/little-quest", "https://d2j6dbq0eux0bg.cloudfront.net/images/131538540/products/822455433/5724916495.png", "Sold out on product page. Pack and case count not listed."],
  ["Little Northwood", "Little Quest", "XL", 1, "https://littlenorthwood.com/products/little-quest", "https://d2j6dbq0eux0bg.cloudfront.net/images/131538540/products/822455433/5724916495.png", "Sold out on product page. Pack and case count not listed."],
  ["Little Northwood", "Little Quest Sample Pack - 2 Diapers", "M / sample pack", 2, "https://littlenorthwood.com/products/little-quest-sample-pack-2-diapers-size-m", "https://d2j6dbq0eux0bg.cloudfront.net/images/131538540/products/831306274/5724968635.png", "Sample pack of 2 diapers. Sold out on product page."],
  ["Potty Training Dropouts", "BeddyByes", "S / case of 40 / 24-32 in.", 40, "https://ptdropouts.com/products/beddybyes", "https://ptdropouts.com/cdn/shop/files/BeddyByes_Pack.jpg?v=1767729885&width=3840", "6500 ml. Sample 3, bag 10, case 40."],
  ["Potty Training Dropouts", "BeddyByes", "M / case of 40 / 29-38 in.", 40, "https://ptdropouts.com/products/beddybyes", "https://ptdropouts.com/cdn/shop/files/BeddyByes_Pack.jpg?v=1767729885&width=3840", "6500 ml. Sample 3, bag 10, case 40."],
  ["Potty Training Dropouts", "BeddyByes", "L / case of 40 / 36-48 in.", 40, "https://ptdropouts.com/products/beddybyes", "https://ptdropouts.com/cdn/shop/files/BeddyByes_Pack.jpg?v=1767729885&width=3840", "6500 ml. Sample 3, bag 10, case 40."],
  ["Potty Training Dropouts", "BeddyByes", "XL / case of 40 / 40-56 in.", 40, "https://ptdropouts.com/products/beddybyes", "https://ptdropouts.com/cdn/shop/files/BeddyByes_Pack.jpg?v=1767729885&width=3840", "6500 ml. Sample 3, bag 10, case 40."],
  ["LNGU", "Big Ears Baby", "M / case of 40 / 27-39 in.", 40, "https://lngu-abdl.com/products/big-ears-baby", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1.png?v=1738163787", "7000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Big Ears Baby", "L / case of 40 / 39-51 in.", 40, "https://lngu-abdl.com/products/big-ears-baby", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1.png?v=1738163787", "7000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Big Ears Baby", "XL / case of 40 / 40-58 in.", 40, "https://lngu-abdl.com/products/big-ears-baby", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1.png?v=1738163787", "7000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Cloud Ultra White", "M / case of 40 / 27-40 in.", 40, "https://lngu-abdl.com/products/cloud-ultra-white", "https://lngu-abdl.com/cdn/shop/files/Plandetravail1copie1.png?v=1773669383", "11000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Cloud Ultra White", "L / case of 40 / 35-47 in.", 40, "https://lngu-abdl.com/products/cloud-ultra-white", "https://lngu-abdl.com/cdn/shop/files/Plandetravail1copie1.png?v=1773669383", "11000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Cloud Ultra White", "XL / case of 40 / 45-55 in.", 40, "https://lngu-abdl.com/products/cloud-ultra-white", "https://lngu-abdl.com/cdn/shop/files/Plandetravail1copie1.png?v=1773669383", "11000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Dragoonz", "M / case of 40 / 30-40 in.", 40, "https://lngu-abdl.com/products/dragoonz", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1_1.png?v=1738163858", "9500 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Dragoonz", "L / case of 40 / 38-48 in.", 40, "https://lngu-abdl.com/products/dragoonz", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1_1.png?v=1738163858", "9500 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Dragoonz", "XL / case of 40 / 46-58 in.", 40, "https://lngu-abdl.com/products/dragoonz", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1_1.png?v=1738163858", "9500 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Honey Tales", "M / case of 40 / 27-40 in.", 40, "https://lngu-abdl.com/products/honey-tales", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1_3.png?v=1738164074", "7000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Honey Tales", "L / case of 40 / 40-50 in.", 40, "https://lngu-abdl.com/products/honey-tales", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1_3.png?v=1738164074", "7000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Honey Tales", "XL / case of 40 / 45-62 in.", 40, "https://lngu-abdl.com/products/honey-tales", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1_3.png?v=1738164074", "7000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Little Melody", "M / case of 40 / 27-40 in.", 40, "https://lngu-abdl.com/products/little-melody", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1_2.png?v=1738164115", "7500 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Little Melody", "L / case of 40 / 40-50 in.", 40, "https://lngu-abdl.com/products/little-melody", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1_2.png?v=1738164115", "7500 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Little Melody", "XL / case of 40 / 45-62 in.", 40, "https://lngu-abdl.com/products/little-melody", "https://lngu-abdl.com/cdn/shop/files/Plan_de_travail_1_2.png?v=1738164115", "7500 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Rainbow Pastel Colors", "M / case of 40 / 27-40 in.", 40, "https://lngu-abdl.com/products/rainbow-pastel-colors", "https://lngu-abdl.com/cdn/shop/files/Plandetravail1_20.png?v=1773674149", "8000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Rainbow Pastel Colors", "L / case of 40 / 35-47 in.", 40, "https://lngu-abdl.com/products/rainbow-pastel-colors", "https://lngu-abdl.com/cdn/shop/files/Plandetravail1_20.png?v=1773674149", "8000 ml. Pack 10, case options 40 or 80."],
  ["LNGU", "Rainbow Pastel Colors", "XL / case of 40 / 45-55 in.", 40, "https://lngu-abdl.com/products/rainbow-pastel-colors", "https://lngu-abdl.com/cdn/shop/files/Plandetravail1_20.png?v=1773674149", "8000 ml. Pack 10, case options 40 or 80."]
].map(([brand, style, size, stock_count, product_url, image_url, notes]) => ({ brand, style, size, stock_count, product_url, image_url, notes }));

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
  const { data: memberships } = await supabase.from("household_members").select("*, households(*)").eq("user_id", session.user.id).eq("status", "active");
  const member = memberships?.[0];
  const household = member?.households;
  const isOwner = member?.role === "owner" || household?.owner_id === session.user.id;
  return isOwner ? { household } : null;
}

function selectedPreset(form) {
  return presets[Number(form.elements.extra_preset.value)] || presets[0];
}

function fillPreset(form) {
  const item = selectedPreset(form);
  form.elements.extra_size.value = item.size;
  form.elements.extra_stock_count.value = item.stock_count;
  form.elements.extra_purchase_price.value = "0.00";
  form.querySelector("[data-extra-detail]").innerHTML = `
    <span style="display:flex;gap:12px;align-items:center;grid-column:1/-1">
      <img src="${esc(item.image_url)}" alt="" style="width:74px;height:82px;object-fit:cover;border-radius:8px;border:1px solid #d7e0ea">
      <span><strong>${esc(item.brand)} ${esc(item.style)}</strong><br>${esc(item.notes)}<br><a href="${esc(item.product_url)}" target="_blank" rel="noopener">View product</a></span>
    </span>
  `;
}

function cardHtml() {
  return `
    <article class="card" id="extraPresetCard" style="margin-top:14px">
      <h3>More Disposable Presets</h3>
      <p>Little Northwood, Potty Training Dropouts, and LNGU catalog items from the latest CSV.</p>
      <form id="extraPresetForm" class="form-grid" style="margin-top:12px">
        <label>Preset<select name="extra_preset">${presets.map((item, index) => `<option value="${index}">${esc(item.brand)} - ${esc(item.style)} (${esc(item.size)})</option>`).join("")}</select></label>
        <label>Size or pack<input name="extra_size" type="text"></label>
        <label>Total count<input name="extra_stock_count" type="number" min="0" step="1"></label>
        <label>Price paid<input name="extra_purchase_price" type="number" min="0" step="0.01"></label>
        <p class="muted" data-extra-detail></p>
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
  const item = selectedPreset(form);
  const { error } = await supabase.from("diapers").insert({
    household_id: ctx.household.id,
    brand: item.brand,
    style: item.style,
    size: form.elements.extra_size.value.trim() || item.size,
    item_type: "disposable",
    stock_count: Number(form.elements.extra_stock_count.value || item.stock_count || 0),
    clean_count: 0,
    purchase_price: Number(form.elements.extra_purchase_price.value || 0)
  });
  if (error) return toast(`Preset could not save: ${error.message}`);
  toast(`Added ${item.brand} ${item.style}.`);
  setTimeout(() => location.reload(), 700);
}

async function injectCard() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  if (title !== "Inventory" || document.getElementById("extraPresetCard")) return;
  const ctx = await loadOwnerContext();
  if (!ctx) return;
  const anchor = document.getElementById("presetCatalogCard") || document.getElementById("starterImportBtn")?.closest(".card") || document.getElementById("view")?.querySelector(".card");
  if (!anchor) return;
  anchor.insertAdjacentHTML("afterend", cardHtml());
  const form = document.getElementById("extraPresetForm");
  fillPreset(form);
  form.elements.extra_preset.addEventListener("change", () => fillPreset(form));
  form.addEventListener("submit", savePreset);
}

new MutationObserver(injectCard).observe(document.getElementById("app"), { childList: true, subtree: true });
injectCard();
