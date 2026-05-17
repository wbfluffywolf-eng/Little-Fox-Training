import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const products = [
  {
    name: "Lounge Brief: Reusable Pull-On Adult Cloth Diaper with Built-in Absorbency",
    price: 64.99,
    sizes: ["Small", "Medium", "Large", "XL"],
    colors: ["Tux", "Navy", "Dove", "White", "Azalea", "Breeze", "Blue Ridge", "Capybara", "Bookworm", "Violet", "Pretty in Pink", "Gotham", "Arthur", "Sailboat"]
  },
  {
    name: "Threaded Armor Reusable Protective Briefs",
    price: 64.99,
    sizes: ["Small", "Medium", "Large", "XL"],
    colors: ["Tux", "Dove", "Navy", "White", "Azalea", "Breeze", "Blue Ridge", "Capybara", "Bookworm", "Arthur", "Violet", "Sailor", "Pretty in Pink", "Gotham"]
  },
  {
    name: "Protective Briefs with Snaps",
    price: 64.99,
    sizes: ["Small", "Medium", "Large", "XL"],
    colors: ["White", "Navy", "Breeze", "Dove", "Tux", "Violet", "Gotham", "Dynasty"]
  },
  {
    name: "The Basic Brief - Adult Diaper Lite",
    price: 54.99,
    sizes: ["Small", "Medium", "Large", "XL"],
    colors: ["Dove", "Sailboat", "Tux", "Navy", "White"]
  }
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

function options(values) {
  return values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
}

async function loadOwnerHousehold() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data, error } = await supabase
    .from("household_members")
    .select("role, households(id, owner_id)")
    .eq("user_id", session.user.id)
    .eq("status", "active");
  if (error) throw error;

  const membership = data?.find(row => row.role === "owner" || row.households?.owner_id === session.user.id);
  return membership?.households || null;
}

function cardHtml() {
  return `
    <article class="card" id="threadedArmorPrintCard">
      <h3>ThreadedArmor Prints</h3>
      <form id="threadedArmorPrintForm" class="grid" style="margin-top:12px">
        <div class="form-grid">
          <label>Product<select name="product">${options(products.map(product => product.name))}</select></label>
          <label>Print or color<select name="color"></select></label>
          <label>Size<select name="size"></select></label>
          <label>Total count<input name="stock_count" type="number" min="1" step="1" value="1"></label>
          <label>Price paid<input name="purchase_price" type="number" min="0" step="0.01"></label>
        </div>
        <p class="muted" data-threadedarmor-detail></p>
        <button class="btn fox" type="submit">Add ThreadedArmor</button>
      </form>
    </article>
  `;
}

function selectedProduct(form) {
  return products.find(product => product.name === form.elements.product.value) || products[0];
}

function configureForm(form) {
  function refresh() {
    const product = selectedProduct(form);
    form.elements.color.innerHTML = options(product.colors);
    form.elements.size.innerHTML = options(product.sizes);
    form.elements.purchase_price.value = product.price.toFixed(2);
    form.querySelector("[data-threadedarmor-detail]").textContent = `Threaded Armor ${product.name} - ${form.elements.color.value}`;
  }

  form.elements.product.addEventListener("change", refresh);
  form.elements.color.addEventListener("change", () => {
    const product = selectedProduct(form);
    form.querySelector("[data-threadedarmor-detail]").textContent = `Threaded Armor ${product.name} - ${form.elements.color.value}`;
  });
  refresh();

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const household = await loadOwnerHousehold();
    if (!household) return toast("Only the account owner can add inventory.");

    const product = selectedProduct(form);
    const count = Number(form.elements.stock_count.value || 1);
    const color = form.elements.color.value;
    const { error } = await supabase.from("diapers").insert({
      household_id: household.id,
      brand: "Threaded Armor",
      style: `${product.name} - ${color}`,
      size: form.elements.size.value,
      item_type: "cloth",
      stock_count: count,
      clean_count: count,
      purchase_price: Number(form.elements.purchase_price.value || product.price || 0)
    });
    if (error) return toast(error.message);
    toast("ThreadedArmor item added.");
    document.getElementById("view")?.removeAttribute("data-inventory-rebuilt");
    document.querySelector('[data-tab="inventory"]')?.click();
  });
}

function injectCard() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const presetForm = document.getElementById("inventoryPresetForm");
  if (title !== "Inventory" || !presetForm || document.getElementById("threadedArmorPrintCard")) return;

  presetForm.closest(".card")?.insertAdjacentHTML("afterend", cardHtml());
  const form = document.getElementById("threadedArmorPrintForm");
  if (form) configureForm(form);
}

document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="inventory"]')) setTimeout(injectCard, 250);
});

new MutationObserver(injectCard).observe(document.body, { childList: true, subtree: true });
[0, 600, 1500].forEach(delay => setTimeout(injectCard, delay));
