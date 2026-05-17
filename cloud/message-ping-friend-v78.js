import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3200);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function option(item) {
  return `<option value="${esc(item.id)}">${esc(item.brand)} ${esc(item.style)}${item.size ? ` (${esc(item.size)})` : ""}</option>`;
}

async function messageContext() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data: memberships } = await supabase
    .from("household_members")
    .select("household_id, user_id, status, invite_email, role, can_send_messages, households(owner_id, name)")
    .eq("status", "active");
  const mine = (memberships || []).filter(row => row.user_id === session.user.id);
  const householdIds = [...new Set(mine.map(row => row.household_id).filter(Boolean))];
  const { data: diapers } = householdIds.length
    ? await supabase.from("diapers").select("id, household_id, brand, style, size").in("household_id", householdIds).order("created_at", { ascending: false }).limit(500)
    : { data: [] };
  return { session, members: memberships || [], diapers: diapers || [] };
}

function ownedHousehold(ctx, userId) {
  return ctx.members.find(member => member.user_id === userId && member.households?.owner_id === userId)?.household_id || "";
}

function writableFriendHousehold(ctx, recipientId) {
  const targetHousehold = ownedHousehold(ctx, recipientId);
  if (!targetHousehold) return "";
  const mine = ctx.members.find(member => member.household_id === targetHousehold && member.user_id === ctx.session.user.id);
  const recipient = ctx.members.find(member => member.household_id === targetHousehold && member.user_id === recipientId);
  if (!mine || !recipient) return "";
  if (mine.role === "owner" || mine.can_send_messages === true || mine.households?.owner_id === ctx.session.user.id) return targetHousehold;
  return "";
}

async function friendDiapers(ctx, recipientId) {
  const householdId = ownedHousehold(ctx, recipientId);
  if (!householdId) return [];
  const cached = ctx.diapers.filter(item => item.household_id === householdId);
  if (cached.length) return cached;
  const { data } = await supabase
    .from("diapers")
    .select("id, household_id, brand, style, size")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false })
    .limit(250);
  return data || [];
}

async function patchPingSelect() {
  const form = document.getElementById("messageForm");
  if (!form?.elements.diaper_id || !form.elements.recipient_id) return;
  const ctx = await messageContext();
  if (!ctx) return;
  const recipientId = form.elements.recipient_id.value;
  const householdId = writableFriendHousehold(ctx, recipientId);
  const diapers = householdId ? await friendDiapers(ctx, recipientId) : [];
  const diaperSelect = form.elements.diaper_id;
  const label = diaperSelect.closest("label");
  if (label?.childNodes[0]?.nodeType === Node.TEXT_NODE) label.childNodes[0].textContent = "Friend's diaper / ping";
  diaperSelect.innerHTML = diapers.length
    ? `<option value="">None</option>${diapers.map(option).join("")}`
    : `<option value="">No visible friend diapers</option>`;
  const householdInput = form.querySelector('input[name="household_id"]');
  if (householdInput && householdId) householdInput.value = householdId;
}

document.addEventListener("submit", async event => {
  const form = event.target;
  if (form?.id !== "messageForm") return;
  const action = form.dataset.pendingAction || event.submitter?.value || "message";
  if (action !== "diaper_ping") return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const ctx = await messageContext();
  if (!ctx) return toast("Please sign in again.");
  const data = new FormData(form);
  const recipientId = String(data.get("recipient_id") || "").trim();
  const diaperId = String(data.get("diaper_id") || "").trim();
  if (!recipientId) return toast("Choose a friend first.");
  if (!diaperId) return toast("Choose one of your friend's visible diapers before sending a diaper ping.");

  const householdId = writableFriendHousehold(ctx, recipientId);
  const diapers = await friendDiapers(ctx, recipientId);
  if (!householdId || !diapers.some(item => item.id === diaperId)) {
    return toast("That diaper is not in this friend's visible inventory.");
  }

  const button = event.submitter;
  const originalText = button?.textContent || "Send";
  if (button) {
    button.disabled = true;
    button.textContent = "Sending...";
  }
  const note = String(data.get("body") || "").trim();
  const { error } = await supabase.from("messages").insert({
    household_id: householdId,
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
  if (error) return toast(`Diaper ping could not send: ${error.message}`);
  toast("Diaper ping sent.");
  document.querySelector('[data-tab="messages"]')?.click();
}, true);

document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="messages"], [data-message-contact]')) {
    setTimeout(() => patchPingSelect().catch(() => {}), 200);
    setTimeout(() => patchPingSelect().catch(() => {}), 900);
  }
});

document.addEventListener("change", event => {
  if (event.target?.matches?.('#messageForm select[name="recipient_id"]')) patchPingSelect().catch(() => {});
});

[600, 1600, 3000].forEach(delay => setTimeout(() => patchPingSelect().catch(() => {}), delay));
