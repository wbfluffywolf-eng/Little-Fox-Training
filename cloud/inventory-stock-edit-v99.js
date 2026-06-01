import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const clothTypes = new Set(["cloth", "cloth_insert", "underpad"]);

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) {
    window.alert(message);
    return;
  }
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function findInventoryDeleteButtons() {
  return [
    ...document.querySelectorAll("[data-inventory-delete]"),
    ...document.querySelectorAll("[data-delete-diaper]")
  ];
}

function itemIdFromDeleteButton(button) {
  return button.dataset.inventoryDelete || button.dataset.deleteDiaper || "";
}

function addEditButtons() {
  findInventoryDeleteButtons().forEach(deleteButton => {
    const id = itemIdFromDeleteButton(deleteButton);
    if (!id || deleteButton.parentElement?.querySelector(`[data-inventory-stock-edit="${CSS.escape(id)}"]`)) return;

    const editButton = document.createElement("button");
    editButton.className = "btn secondary";
    editButton.type = "button";
    editButton.dataset.inventoryStockEdit = id;
    editButton.textContent = "Edit item";
    deleteButton.insertAdjacentElement("beforebegin", editButton);
  });
}

function validCount(value) {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count >= 0 ? count : null;
}

async function editStockCount(id) {
  const { data: item, error } = await supabase
    .from("diapers")
    .select("id, brand, style, item_type, stock_count, clean_count, purchase_price")
    .eq("id", id)
    .single();
  if (error) return toast(error.message);

  const name = `${item.brand || "Item"} ${item.style || ""}`.trim();
  const stockValue = window.prompt(`How many ${name} are in stock?`, String(Number(item.stock_count || 0)));
  if (stockValue === null) return;

  const stockCount = validCount(stockValue);
  if (stockCount === null) return toast("Enter a valid stock count.");

  const updates = { stock_count: stockCount };
  if (clothTypes.has(item.item_type)) {
    const cleanValue = window.prompt(`How many ${name} are clean and ready?`, String(Number(item.clean_count ?? stockCount)));
    if (cleanValue === null) return;

    const cleanCount = validCount(cleanValue);
    if (cleanCount === null) return toast("Enter a valid clean count.");
    updates.clean_count = Math.min(cleanCount, stockCount);
  }

  const priceValue = window.prompt(`What price should be saved for ${name}?`, Number(item.purchase_price || 0).toFixed(2));
  if (priceValue === null) return;

  const purchasePrice = Number(priceValue);
  if (!Number.isFinite(purchasePrice) || purchasePrice < 0) return toast("Enter a valid price.");
  updates.purchase_price = purchasePrice;

  const { error: updateError } = await supabase.from("diapers").update(updates).eq("id", id);
  if (updateError) return toast(updateError.message);
  toast("Inventory item updated.");

  const inventoryTab = document.querySelector('[data-tab="inventory"]');
  if (inventoryTab) {
    inventoryTab.click();
    setTimeout(addEditButtons, 500);
  } else {
    window.location.reload();
  }
}

document.addEventListener("click", event => {
  const editButton = event.target.closest("[data-inventory-stock-edit]");
  if (editButton) {
    event.preventDefault();
    editStockCount(editButton.dataset.inventoryStockEdit);
    return;
  }

  if (event.target.closest('[data-tab="inventory"]')) {
    setTimeout(addEditButtons, 500);
    setTimeout(addEditButtons, 1500);
  }
});

new MutationObserver(addEditButtons).observe(document.body, { childList: true, subtree: true });
[0, 500, 1500, 3000].forEach(delay => setTimeout(addEditButtons, delay));
