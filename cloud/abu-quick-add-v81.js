import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const products = [
  { name: "AlphaGatorZ", sizes: ["Medium", "Large", "XL"], bag: 46.99, case40: 150.37, case80: 281.94 },
  { name: "BeddyByes", sizes: ["Medium"], bag: 40.99, case40: 131.17, case80: 245.94 },
  { name: "BunnyHopps 4-Tape", sizes: ["Medium", "Large", "XL"], bag: 40.99, case40: 131.17, case80: 245.94 },
  { name: "DinoRawrZ", sizes: ["Medium", "Large", "XL"], bag: 34.99, case40: 111.97, case80: 209.94 },
  { name: "Little Kings", sizes: ["Medium", "Large", "XL"], bag: 46.99, case40: 150.37, case80: 281.94 },
  { name: "LittlePawz", sizes: ["Small", "Medium", "Large", "XL"], bag: 40.99, case40: 131.17, case80: 245.94 },
  { name: "Oops All Huskies", sizes: ["Medium", "Large", "XL", "XL+"], bag: 42.99, case40: 137.57, case80: 257.94 },
  { name: "PeekABU", sizes: ["Medium", "Large", "XL", "XL+"], bag: 42.99, case40: 137.57, case80: 257.94 },
  { name: "Simple Daytime", sizes: ["Small", "Medium", "Large", "XL"], bag: 37.99, case40: 121.57, case80: 227.94 },
  { name: "Simple Ultra", sizes: ["Medium", "Large", "XL"], bag: 38.99, case40: 124.77, case80: 233.94 },
  { name: "Super Dry Kids", sizes: ["Small", "Medium", "Large", "XL"], bag: 32.99, case40: 105.57, case80: 197.94 },
  { name: "TinyTails", sizes: ["Small", "Medium", "Large", "XL"], bag: 44.99, case40: 143.97, case80: 269.94 },
  { name: "PowerUps Europe Edition", sizes: ["One size"], bag: 29.99, case40: 0, case80: 0, type: "disposable_insert", count: 20 }
];

const packages = [
  { label: "Pack - 10 diapers", count: 10, priceKey: "bag" },
  { label: "4 packs - 40 diapers", count: 40, priceKey: "case40" },
  { label: "8 packs - 80 diapers", count: 80, priceKey: "case80" }
];

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

function optionHtml(values) {
  return values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
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

function selectedProduct(form) {
  return products.find(product => product.name === form.elements.product.value) || products[0];
}

function selectedPackage(form) {
  return packages.find(pack => pack.label === form.elements.package.value) || packages[0];
}

function cardHtml() {
  return `
    <article class="card" id="abuQuickAddCard">
      <h3>ABU Quick Add</h3>
      <form id="abuQuickAddForm" class="grid" style="margin-top:12px">
        <div class="form-grid">
          <label>Diaper<select name="product">${optionHtml(products.map(product => product.name))}</select></label>
          <label>Size<select name="size"></select></label>
          <label>Package<select name="package">${optionHtml(packages.map(pack => pack.label))}</select></label>
          <label>Total count<input name="stock_count" type="number" min="1" step="1" value="10"></label>
          <label>Price paid<input name="purchase_price" type="number" min="0" step="0.01"></label>
        </div>
        <p class="muted" data-abu-detail></p>
        <button class="btn fox" type="submit">Add ABU</button>
      </form>
    </article>
  `;
}

function refreshForm(form) {
  const product = selectedProduct(form);
  const currentSize = form.elements.size.value;
  form.elements.size.innerHTML = optionHtml(product.sizes);
  if (product.sizes.includes(currentSize)) form.elements.size.value = currentSize;
  const pack = selectedPackage(form);
  const isBooster = product.type === "disposable_insert";
  form.elements.package.closest("label").style.display = isBooster ? "none" : "";
  form.elements.stock_count.value = isBooster ? product.count || 20 : pack.count;
  form.elements.purchase_price.value = Number(isBooster ? product.bag : product[pack.priceKey] || product.bag || 0).toFixed(2);
  form.querySelector("[data-abu-detail]").textContent = `ABU ${product.name} - ${form.elements.size.value}`;
}

function configureForm(form) {
  form.elements.product.addEventListener("change", () => refreshForm(form));
  form.elements.package.addEventListener("change", () => refreshForm(form));
  form.elements.size.addEventListener("change", () => refreshForm(form));
  refreshForm(form);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const household = await ownerHousehold();
    if (!household) return toast("Only the account owner can add inventory.");
    const product = selectedProduct(form);
    const pack = selectedPackage(form);
    const count = Math.max(1, Number(form.elements.stock_count.value || 1));
    const style = product.type === "disposable_insert" ? product.name : `${product.name} - ${pack.label}`;
    const { error } = await supabase.from("diapers").insert({
      household_id: household.id,
      brand: "ABU",
      style,
      size: form.elements.size.value,
      item_type: product.type || "disposable",
      stock_count: count,
      clean_count: count,
      purchase_price: Number(form.elements.purchase_price.value || 0)
    });
    if (error) return toast(error.message);
    toast("ABU item added.");
    document.getElementById("view")?.removeAttribute("data-inventory-rebuilt");
    document.querySelector('[data-tab="inventory"]')?.click();
  });
}

function injectCard() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const presetForm = document.getElementById("inventoryPresetForm");
  if (title !== "Inventory" || !presetForm || document.getElementById("abuQuickAddCard")) return;
  const threadedCard = document.getElementById("threadedArmorPrintCard");
  (threadedCard || presetForm.closest(".card"))?.insertAdjacentHTML("afterend", cardHtml());
  const form = document.getElementById("abuQuickAddForm");
  if (form) configureForm(form);
}

document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="inventory"]')) setTimeout(injectCard, 250);
});

new MutationObserver(injectCard).observe(document.body, { childList: true, subtree: true });
[0, 600, 1500].forEach(delay => setTimeout(injectCard, delay));
