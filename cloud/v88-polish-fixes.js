import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function currentTitle() {
  return document.querySelector(".topbar h2")?.textContent.trim() || "";
}

async function ownedHouseholdFor(userId) {
  const { data } = await supabase
    .from("household_members")
    .select("household_id, user_id, role, status, can_send_messages, households(owner_id)")
    .eq("status", "active");
  const rows = data || [];
  const owned = rows.find(row => row.user_id === userId && row.households?.owner_id === userId);
  return { householdId: owned?.household_id || "", rows };
}

async function personalHousehold() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;
  const { householdId, rows } = await ownedHouseholdFor(user.id);
  return householdId ? { user, householdId, rows } : null;
}

function optionFor(item) {
  const count = Number(item.stock_count ?? item.clean_count ?? 0);
  const suffix = Number.isFinite(count) ? ` - ${count} in inventory` : "";
  return `<option value="${esc(item.id)}">${esc(item.brand)} ${esc(item.style)}${item.size ? ` (${esc(item.size)})` : ""}${esc(suffix)}</option>`;
}

async function friendInventory(recipientId) {
  if (!recipientId) return { householdId: "", diapers: [] };
  const { householdId } = await ownedHouseholdFor(recipientId);
  if (!householdId) return { householdId: "", diapers: [] };
  const { data } = await supabase
    .from("diapers")
    .select("id, household_id, brand, style, size, stock_count, clean_count")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(500);
  return { householdId, diapers: data || [] };
}

async function fixMessageDiaperPicker() {
  const form = document.getElementById("messageForm");
  const recipient = form?.elements?.recipient_id;
  const diaper = form?.elements?.diaper_id;
  if (!form || !recipient || !diaper) return;
  const { householdId, diapers } = await friendInventory(recipient.value);
  const previous = diaper.value;
  const label = diaper.closest("label");
  if (label?.childNodes[0]?.nodeType === Node.TEXT_NODE) label.childNodes[0].textContent = "Friend's diaper / ping";
  diaper.innerHTML = diapers.length
    ? `<option value="">None</option>${diapers.map(optionFor).join("")}`
    : `<option value="">No visible friend diapers</option>`;
  if (previous && diapers.some(item => item.id === previous)) diaper.value = previous;
  const householdInput = form.querySelector('input[name="household_id"]');
  if (householdInput && householdId) householdInput.value = householdId;
}

function dedupePerformanceCards() {
  if (currentTitle() !== "Trends") return;
  const cards = [...document.querySelectorAll("#view .card")]
    .filter(card => card.id === "diaperPerformanceCard" || card.querySelector("h3")?.textContent.trim() === "Diaper Performance");
  cards.forEach((card, index) => {
    if (index === 0) card.id = "diaperPerformanceCard";
    else card.remove();
  });
}

async function fixTrendSpending() {
  if (currentTitle() !== "Trends") return;
  const ctx = await personalHousehold();
  if (!ctx) return;
  const [diapersResult, expensesResult] = await Promise.all([
    supabase.from("diapers").select("item_type, purchase_price").eq("household_id", ctx.householdId).limit(1000),
    supabase.from("expenses").select("amount, category").eq("household_id", ctx.householdId).limit(500)
  ]);
  const diapers = diapersResult.data || [];
  const expenses = expensesResult.data || [];
  const typeFor = item => {
    const type = String(item.item_type || "").toLowerCase();
    const category = String(item.category || "").toLowerCase();
    if (["cloth", "cloth_insert", "underpad"].includes(type) || category.includes("cloth")) return "Cloth";
    if (["disposable", "disposable_insert"].includes(type) || category.includes("diaper") || category.includes("booster") || category.includes("insert")) return "Disposable";
    if (category.includes("supply") || category.includes("cream") || category.includes("wipe") || category.includes("powder") || category.includes("pad")) return "Supplies";
    return "Disposable";
  };
  const rowValue = name =>
    diapers.filter(item => typeFor(item) === name).reduce((sum, item) => sum + Number(item.purchase_price || 0), 0)
    + expenses.filter(item => typeFor(item) === name).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const values = {
    Disposable: rowValue("Disposable"),
    Cloth: rowValue("Cloth"),
    Supplies: rowValue("Supplies")
  };
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  const totalCard = [...document.querySelectorAll("#view .card h3")]
    .find(heading => heading.textContent.trim() === "Total Spent")?.closest(".card");
  const totalValue = totalCard?.querySelector("h2");
  if (totalValue) totalValue.textContent = money(total);
  const expenseCard = [...document.querySelectorAll("#view .card h3")]
    .find(heading => heading.textContent.trim() === "Expense Split")?.closest(".card");
  if (expenseCard) {
    const max = Math.max(1, ...Object.values(values));
    expenseCard.querySelector(".bars").innerHTML = Object.entries(values).map(([label, value]) => `
      <div class="bar-row">
        <span>${esc(label)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, value / max * 100)}%"></div></div>
        <b>${esc(money(value))}</b>
      </div>
    `).join("");
  }
}

async function annotateLogInventory() {
  const form = document.getElementById("logForm") || document.getElementById("clothWearForm");
  if (!form) return;
  const ctx = await personalHousehold();
  if (!ctx) return;
  const { data } = await supabase
    .from("diapers")
    .select("id, item_type, stock_count, clean_count")
    .eq("household_id", ctx.householdId)
    .limit(1000);
  const items = data || [];
  form.querySelectorAll("select").forEach(select => {
    [...select.options].forEach(option => {
      if (!option.value || / - \d+ in inventory$/.test(option.textContent || "")) return;
      const item = items.find(row => row.id === option.value);
      if (!item) return;
      const count = ["cloth", "cloth_insert", "underpad"].includes(item.item_type)
        ? Number(item.clean_count ?? item.stock_count ?? 0)
        : Number(item.stock_count ?? 0);
      if (Number.isFinite(count)) option.textContent = `${option.textContent} - ${count} in inventory`;
    });
  });
}

function refreshSoon() {
  [80, 350, 1000].forEach(delay => setTimeout(() => {
    fixMessageDiaperPicker().catch(() => {});
    fixTrendSpending().catch(() => {});
    annotateLogInventory().catch(() => {});
    dedupePerformanceCards();
  }, delay));
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-tab], [data-message-contact], [data-reply-diaper-check]")) refreshSoon();
});

document.addEventListener("change", event => {
  if (event.target?.matches?.('#messageForm select[name="recipient_id"]')) {
    fixMessageDiaperPicker().catch(() => {});
  }
});

new MutationObserver(() => {
  dedupePerformanceCards();
  if (currentTitle() === "Trends") fixTrendSpending().catch(() => {});
}).observe(document.body, { childList: true, subtree: true });

refreshSoon();
