import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const selectedContactKeyPrefix = "littleFoxActiveMessageContact";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3600);
}

function can(member, permission) {
  return member?.role === "owner" || member?.[permission] === true;
}

async function loadFriendContext() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data: memberships, error } = await supabase
    .from("household_members")
    .select("*, households(owner_id, name)")
    .eq("status", "active");
  if (error) throw error;

  const mine = (memberships || []).filter(member => member.user_id === session.user.id);
  const personal = mine.find(member => member.role === "owner" || member.households?.owner_id === session.user.id) || mine[0];
  const shared = mine.filter(member => member.id !== personal?.id && member.households?.owner_id !== session.user.id);
  return { session, memberships: memberships || [], mine, personal, shared };
}

function ownedHouseholdFor(ctx, userId) {
  return ctx.memberships.find(member => member.user_id === userId && member.households?.owner_id === userId)?.household_id || "";
}

function selectedContactId(ctx) {
  const key = `${selectedContactKeyPrefix}:${ctx.personal?.household_id || "default"}`;
  const saved = sessionStorage.getItem(key);
  const ids = new Set(ctx.shared.map(member => member.households?.owner_id).filter(Boolean));
  return ids.has(saved) ? saved : [...ids][0] || "";
}

function setSelectedContact(ctx, userId) {
  if (!userId) return;
  sessionStorage.setItem(`${selectedContactKeyPrefix}:${ctx.personal?.household_id || "default"}`, userId);
}

function friendshipForContact(ctx, contactId) {
  const householdId = ownedHouseholdFor(ctx, contactId);
  return ctx.mine.find(member => member.household_id === householdId && member.status === "active") || null;
}

async function visibleFriendDiapers(ctx, contactId) {
  const member = friendshipForContact(ctx, contactId);
  if (!member || !can(member, "can_view_inventory")) return { member, diapers: [], error: null };
  const { data, error } = await supabase
    .from("diapers")
    .select("id, household_id, brand, style, size, item_type, stock_count, clean_count")
    .eq("household_id", member.household_id)
    .order("created_at", { ascending: false })
    .limit(300);
  return { member, diapers: data || [], error };
}

function option(item) {
  const count = Number(item.stock_count ?? item.clean_count ?? 0);
  const countText = Number.isFinite(count) ? ` - ${count} in stock` : "";
  return `<option value="${esc(item.id)}">${esc(item.brand)} ${esc(item.style)}${item.size ? ` (${esc(item.size)})` : ""}${esc(countText)}</option>`;
}

function friendInventoryCard(member, diapers, error) {
  if (!member) return "";
  if (!can(member, "can_view_inventory")) {
    return `<article class="card" id="friendPingInventoryCard" style="margin-top:14px"><h3>Diaper Stock</h3><div class="empty">This friend has not shared inventory with you yet.</div></article>`;
  }
  if (error) {
    return `<article class="card" id="friendPingInventoryCard" style="margin-top:14px"><h3>Diaper Stock</h3><div class="empty">Inventory could not load: ${esc(error.message)}</div></article>`;
  }
  return `
    <article class="card" id="friendPingInventoryCard" style="margin-top:14px">
      <h3>Diaper Stock</h3>
      <div class="list" style="margin-top:12px">
        ${diapers.map(item => `<div class="item"><div class="item-head"><div><h4>${esc(item.brand)} ${esc(item.style)}</h4><p>${esc(item.size || item.item_type || "No size")}</p></div><strong>${Number(item.stock_count ?? item.clean_count ?? 0)}</strong></div></div>`).join("") || `<div class="empty">This friend's inventory is empty.</div>`}
      </div>
    </article>
  `;
}

async function patchMessagePingForm() {
  const form = document.getElementById("messageForm");
  if (!form?.elements.recipient_id || !form.elements.diaper_id) return;
  const ctx = await loadFriendContext();
  if (!ctx) return;
  const contactId = form.elements.recipient_id.value || selectedContactId(ctx);
  if (!contactId) return;
  setSelectedContact(ctx, contactId);
  const { member, diapers, error } = await visibleFriendDiapers(ctx, contactId);
  const diaperSelect = form.elements.diaper_id;
  const label = diaperSelect.closest("label");
  if (label?.childNodes[0]?.nodeType === Node.TEXT_NODE) label.childNodes[0].textContent = "Friend's diaper / ping";
  diaperSelect.innerHTML = diapers.length
    ? `<option value="">None</option>${diapers.map(option).join("")}`
    : `<option value="">No visible friend diapers</option>`;
  const householdInput = form.querySelector('input[name="household_id"]');
  if (householdInput && member?.household_id) householdInput.value = member.household_id;
  form.dataset.friendPingHousehold = member?.household_id || "";

  const composer = form.closest(".card");
  const existing = document.getElementById("friendPingInventoryCard");
  const html = friendInventoryCard(member, diapers, error);
  if (existing && html) existing.outerHTML = html;
  else if (!existing && html) composer?.insertAdjacentHTML("beforebegin", html);
}

async function sendDiaperPing(event) {
  const form = event.target;
  if (form?.id !== "messageForm") return;
  const action = form.dataset.pendingAction || event.submitter?.value || "message";
  if (action !== "diaper_ping") return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const ctx = await loadFriendContext();
  if (!ctx) return toast("Please sign in again.");
  const data = new FormData(form);
  const recipientId = String(data.get("recipient_id") || "").trim();
  const diaperId = String(data.get("diaper_id") || "").trim();
  if (!recipientId) return toast("Choose a friend first.");
  if (!diaperId) return toast("Choose one of your friend's visible diapers before sending a diaper ping.");

  const { member, diapers, error } = await visibleFriendDiapers(ctx, recipientId);
  if (error) return toast(`Friend inventory could not load: ${error.message}`);
  if (!member || !can(member, "can_send_messages")) return toast("You do not have permission to message this friend.");
  if (!can(member, "can_view_inventory")) return toast("This friend has not shared inventory, so diaper pings cannot pick a diaper yet.");
  if (!diapers.some(item => item.id === diaperId)) return toast("That diaper is not in this friend's visible inventory.");

  const button = event.submitter;
  const originalText = button?.textContent || "Send Diaper Ping";
  if (button) {
    button.disabled = true;
    button.textContent = "Sending...";
  }
  const note = String(data.get("body") || "").trim();
  const { error: sendError } = await supabase.from("messages").insert({
    household_id: member.household_id,
    sender_id: ctx.session.user.id,
    recipient_id: recipientId,
    body: note ? `Diaper ping: ${note}` : "Diaper ping.",
    diaper_id: diaperId,
    image_data: null
  });
  if (button) {
    button.disabled = false;
    button.textContent = originalText;
  }
  if (sendError) return toast(`Diaper ping could not send: ${sendError.message}`);
  toast("Diaper ping sent.");
  form.reset();
  setTimeout(() => document.querySelector('[data-tab="messages"]')?.click(), 300);
}

document.addEventListener("submit", sendDiaperPing, true);
document.addEventListener("change", event => {
  if (event.target?.matches?.('#messageForm select[name="recipient_id"]')) {
    patchMessagePingForm().catch(error => toast(error.message));
  }
});
document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="messages"], [data-message-contact]')) {
    setTimeout(() => patchMessagePingForm().catch(error => toast(error.message)), 300);
    setTimeout(() => patchMessagePingForm().catch(() => {}), 1200);
  }
});

[800, 1800, 3500].forEach(delay => setTimeout(() => patchMessagePingForm().catch(() => {}), delay));
