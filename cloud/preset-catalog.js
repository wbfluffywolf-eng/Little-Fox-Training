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
  ["disposable", "Tykables", "Overnights", "Medium", 10, 0],
  ["disposable", "Tykables", "Little Builders", "Medium", 10, 0],
  ["disposable", "ABU", "LittlePawz", "Medium", 10, 0],
  ["disposable", "ABU", "BeddyByes", "Medium / case", 80, 225],
  ["disposable", "Potty Training Dropouts", "Training Briefs", "Medium", 10, 0],
  ["disposable", "Little North Woods", "Training Diaper", "Medium", 10, 0],
  ["disposable_insert", "NorthShore", "Booster Pad", "Regular", 30, 0],
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
  ["cloth_insert", "EcoAble", "Cloth Diaper Inserts", "Large", 4, 0],
  ["cloth_insert", "Unknown", "Adult Cloth Diaper Inserts", "Birdseye / Large / 4 pack", 4, 11.88],
  ["underpad", "NorthShore", "Champion XD Washable Underpad", "Large 33x35 in.", 1, 0],
  ["underpad", "ThreadedArmor", "Heavy-Duty Mesh Laundry Bag", "Cloth diaper laundry", 1, 9.95],
  ["disposable", "InControl", "BeDry EliteCare Premium Incontinence Briefs", "Small / case of 36", 36, 0, "https://us.incontroldiapers.com/bedry-elitecare/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/615/2592/BeDry-EliteCare-Lifestyle2__04038.1762362544.jpg?c=1", "Sample 2, bag 12, case 36."],
  ["disposable", "InControl", "BeDry EliteCare Premium Incontinence Briefs", "Medium / case of 36", 36, 0, "https://us.incontroldiapers.com/bedry-elitecare/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/615/2592/BeDry-EliteCare-Lifestyle2__04038.1762362544.jpg?c=1", "Sample 2, bag 12, case 36."],
  ["disposable", "InControl", "BeDry EliteCare Premium Incontinence Briefs", "Large / case of 36", 36, 0, "https://us.incontroldiapers.com/bedry-elitecare/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/615/2592/BeDry-EliteCare-Lifestyle2__04038.1762362544.jpg?c=1", "Sample 2, bag 12, case 36."],
  ["disposable", "InControl", "BeDry EliteCare Premium Incontinence Briefs", "X-Large / case of 36", 36, 0, "https://us.incontroldiapers.com/bedry-elitecare/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/615/2592/BeDry-EliteCare-Lifestyle2__04038.1762362544.jpg?c=1", "Sample 2, bag 12, case 36."],
  ["disposable", "InControl", "BeDry EliteCare Incontinence Briefs - 2XL", "2XL / case of 36", 36, 0, "https://us.incontroldiapers.com/incontrol-bedry-elitecare-incontinence-briefs-2xl/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/625/2335/Elitecare_2XL_Diaper_3__30854.1750521112.jpg?c=1", "58 - 66 inch waist. Sample 2, bag 12, case 36."],
  ["disposable", "InControl", "BeDry Premium Incontinence Briefs", "Small / case of 48", 48, 0, "https://us.incontroldiapers.com/incontrol-bedry-premium-incontinence-briefs/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/610/2587/BeDry-Lifestyle3__76834.1769178689.jpg?c=1", "Sample 2, bag 16, case 48."],
  ["disposable", "InControl", "BeDry Premium Incontinence Briefs", "Medium / case of 48", 48, 0, "https://us.incontroldiapers.com/incontrol-bedry-premium-incontinence-briefs/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/610/2587/BeDry-Lifestyle3__76834.1769178689.jpg?c=1", "Sample 2, bag 16, case 48."],
  ["disposable", "InControl", "BeDry Premium Incontinence Briefs", "Large / case of 48", 48, 0, "https://us.incontroldiapers.com/incontrol-bedry-premium-incontinence-briefs/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/610/2587/BeDry-Lifestyle3__76834.1769178689.jpg?c=1", "Sample 2, bag 16, case 48."],
  ["disposable", "InControl", "BeDry Premium Incontinence Briefs", "X-Large / case of 48", 48, 0, "https://us.incontroldiapers.com/incontrol-bedry-premium-incontinence-briefs/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/610/2587/BeDry-Lifestyle3__76834.1769178689.jpg?c=1", "Sample 2, bag 16, case 48."],
  ["disposable", "InControl", "BeDry Night Premium Incontinence Briefs", "Medium / case of 36", 36, 0, "https://us.incontroldiapers.com/bedry-night/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/614/2663/Male_product_photos_-_lifestyle_shots_BeDry_Night__88741.1770742825.jpg?c=1", "Sample 2, bag 12, case 36."],
  ["disposable", "InControl", "BeDry Night Premium Incontinence Briefs", "Large / case of 36", 36, 0, "https://us.incontroldiapers.com/bedry-night/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/614/2663/Male_product_photos_-_lifestyle_shots_BeDry_Night__88741.1770742825.jpg?c=1", "Sample 2, bag 12, case 36."],
  ["disposable", "InControl", "BeDry Night Premium Incontinence Briefs", "X-Large / case of 36", 36, 0, "https://us.incontroldiapers.com/bedry-night/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/614/2663/Male_product_photos_-_lifestyle_shots_BeDry_Night__88741.1770742825.jpg?c=1", "Sample 2, bag 12, case 36."],
  ["disposable", "InControl", "Active Air Incontinence Briefs", "Medium / case of 60", 60, 0, "https://us.incontroldiapers.com/incontrol-active-air-incontinence-briefs/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/565/2586/Active-Air-Diaper3__75914.1770742895.jpg?c=1", "Bag 20, case 60."],
  ["disposable", "InControl", "Active Air Incontinence Briefs", "Large / case of 60", 60, 0, "https://us.incontroldiapers.com/incontrol-active-air-incontinence-briefs/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/565/2586/Active-Air-Diaper3__75914.1770742895.jpg?c=1", "Bag 20, case 60."],
  ["disposable", "InControl", "Active Air Incontinence Briefs", "XL / case of 60", 60, 0, "https://us.incontroldiapers.com/incontrol-active-air-incontinence-briefs/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/565/2586/Active-Air-Diaper3__75914.1770742895.jpg?c=1", "Bag 20, case 60."],
  ["disposable", "InControl", "BeDry Ultra Premium Underwear", "S/M / case of 96", 96, 0, "https://us.incontroldiapers.com/bedry-ultra-premium-underwear/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/622/2665/Male_product_photos_-_lifestyle_shots_BeDry_Underwear__41790.1770743228.jpg?c=1", "Pull-up underwear. Bag 12, case 96."],
  ["disposable", "InControl", "BeDry Ultra Premium Underwear", "L/XL / case of 96", 96, 0, "https://us.incontroldiapers.com/bedry-ultra-premium-underwear/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/622/2665/Male_product_photos_-_lifestyle_shots_BeDry_Underwear__41790.1770743228.jpg?c=1", "Pull-up underwear. Bag 12, case 96."],
  ["disposable", "InControl", "BeDry Ultra Premium Underwear", "XL+ / case of 96", 96, 0, "https://us.incontroldiapers.com/bedry-ultra-premium-underwear/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/622/2665/Male_product_photos_-_lifestyle_shots_BeDry_Underwear__41790.1770743228.jpg?c=1", "Pull-up underwear. Bag 12, case 96."],
  ["disposable_insert", "InControl", "Booster Pads - Unscented", "One Size / case of 180", 180, 0, "https://us.incontroldiapers.com/incontrol-booster-pads-unscented/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/567/2409/unnamed__99767.1761916739.jpg?c=1", "Bag 30, case 180."],
  ["cloth", "InControl", "Harmony Nighttime Fitted Cloth Diaper", "Small", 1, 0, "https://us.incontroldiapers.com/harmony-diaper/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/632/2584/Harmony-Diaper3__38526.1762287922.jpg?c=1", "Reusable fitted cloth diaper."],
  ["cloth", "InControl", "Harmony Nighttime Fitted Cloth Diaper", "Medium", 1, 0, "https://us.incontroldiapers.com/harmony-diaper/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/632/2584/Harmony-Diaper3__38526.1762287922.jpg?c=1", "Reusable fitted cloth diaper."],
  ["cloth", "InControl", "Harmony Nighttime Fitted Cloth Diaper", "Large", 1, 0, "https://us.incontroldiapers.com/harmony-diaper/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/632/2584/Harmony-Diaper3__38526.1762287922.jpg?c=1", "Reusable fitted cloth diaper."],
  ["cloth", "InControl", "Harmony Nighttime Fitted Cloth Diaper", "X-Large", 1, 0, "https://us.incontroldiapers.com/harmony-diaper/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/632/2584/Harmony-Diaper3__38526.1762287922.jpg?c=1", "Reusable fitted cloth diaper."],
  ["cloth", "InControl", "Organic Adult Nighttime Prefold Cloth Diapers", "Small", 1, 0, "https://us.incontroldiapers.com/organic-adult-prefold-cloth-diapers/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/559/2553/Organic-Prefold-lifestyle2__76084.1761920189.jpg?c=1", "Reusable prefold cloth diaper."],
  ["cloth", "InControl", "Washable Incontinence Protective Briefs", "M", 1, 0, "https://us.incontroldiapers.com/protective-briefs-for-adult-incontinence-black/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/508/1672/Black-pants-11.251247__72912.1757792637.jpg?c=1", "Reusable padded protective underwear."],
  ["cloth", "InControl", "Adult Pocket Diaper - Black", "One Size", 1, 0, "https://us.incontroldiapers.com/adult-pocket-diaper-black/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/494/2272/Adult_Pocket_Diaper_Black__55269.1770038497.jpg?c=1", "Reusable pocket diaper."],
  ["cloth", "InControl", "Adult Pocket Diaper - White", "One Size", 1, 0, "https://us.incontroldiapers.com/adult-pocket-diaper-white/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/493/2670/12.23_02244__30646.1771380224.jpg?c=1", "Reusable pocket diaper."],
  ["cloth", "InControl", "Blue Adult Swim Diaper", "One Size", 1, 0, "https://us.incontroldiapers.com/blue-adult-swim-diaper/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/491/2576/Swim-Diaper-Lifestyle2__97474.1762279498.jpg?c=1", "Reusable swim diaper."],
  ["cloth", "InControl", "Adult Cotton Fitted Snap Diaper", "Medium", 1, 0, "https://us.incontroldiapers.com/super-snap-fitted-diaper/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/220/2307/SnapFit_Diaper_5__64142.1715096886.jpg?c=1", "Reusable fitted snap cloth diaper."],
  ["cloth_insert", "InControl", "Bamboo Contour Booster Pads - 3", "One Size / 3 pack", 3, 0, "https://us.incontroldiapers.com/bamboo-night-boosters-l-xl-2/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/209/1781/Tripple_stack_JPG__04238.1661543030.jpg?c=1", "Reusable booster pad insert."],
  ["cloth_insert", "InControl", "Adult Microfiber Booster Pads - 4", "One Size / 4 pack", 4, 0, "https://us.incontroldiapers.com/adult-microfiber-insert/", "https://cdn11.bigcommerce.com/s-x9xbiccjb1/images/stencil/650x723/products/133/1784/Tripple_stack_JPG__91138.1661546162.jpg?c=1", "Reusable booster pad insert."]
].map(([item_type, brand, style, size, stock_count, purchase_price, product_url = "", image_url = "", notes = ""]) => ({
  item_type,
  brand,
  style,
  size,
  stock_count,
  clean_count: ["cloth", "cloth_insert", "underpad"].includes(item_type) ? stock_count : 0,
  purchase_price,
  product_url,
  image_url,
  notes
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
  const image = item.image_url ? `<img src="${esc(item.image_url)}" alt="" style="width:74px;height:82px;object-fit:cover;border-radius:8px;border:1px solid #d7e0ea">` : "";
  const link = item.product_url ? `<a href="${esc(item.product_url)}" target="_blank" rel="noopener">View product</a>` : "";
  form.querySelector("[data-preset-detail]").innerHTML = `
    <span style="display:flex;gap:12px;align-items:center;grid-column:1/-1">
      ${image}
      <span>
        <strong>${esc(itemTypes[item.item_type])}: ${esc(item.brand)} ${esc(item.style)}</strong><br>
        ${item.notes ? `<span>${esc(item.notes)}</span><br>` : ""}
        ${link}
      </span>
    </span>
  `;
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
