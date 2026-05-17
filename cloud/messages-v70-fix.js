import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const diaperCheckRequestText = "Diaper check requested. Please send a diaper photo.";
const diaperCheckReplyText = "Diaper check photo reply.";
const checkStates = new Set(["wet", "dry", "messy"]);

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

async function context() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;
  const { data: memberships } = await supabase
    .from("household_members")
    .select("household_id, user_id, status, invite_email, role, can_send_messages, households(owner_id, name)")
    .eq("status", "active");
  const mine = (memberships || []).filter(row => row.user_id === session.user.id);
  const householdIds = [...new Set(mine.map(row => row.household_id).filter(Boolean))];
  if (!householdIds.length) return { session, members: [], diapers: [], logs: [] };
  const [members, diapers, logs] = await Promise.all([
    supabase.from("household_members").select("household_id, user_id, status, invite_email, role, can_send_messages, households(owner_id, name)").in("household_id", householdIds).eq("status", "active"),
    supabase.from("diapers").select("id, household_id, brand, style, size").in("household_id", householdIds).order("created_at", { ascending: false }).limit(500),
    supabase.from("logs").select("household_id, diaper_id, happened_at, changed_at, created_at").in("household_id", householdIds).order("happened_at", { ascending: false }).limit(160)
  ]);
  return {
    session,
    members: members.data || [],
    diapers: diapers.data || [],
    logs: logs.data || []
  };
}

function ownedHousehold(ctx, userId) {
  return ctx.members.find(member => member.user_id === userId && member.households?.owner_id === userId)?.household_id || "";
}

function currentDiaper(ctx, userId) {
  const householdId = ownedHousehold(ctx, userId);
  const latest = ctx.logs
    .filter(log => log.household_id === householdId)
    .sort((a, b) => String(b.happened_at || b.changed_at || b.created_at || "").localeCompare(String(a.happened_at || a.changed_at || a.created_at || "")))[0];
  return latest?.diaper_id ? ctx.diapers.find(item => item.id === latest.diaper_id) || { id: latest.diaper_id } : null;
}

function markText(ctx, userId) {
  const item = currentDiaper(ctx, userId);
  if (!item) return "";
  const title = item.brand ? `Wearing ${item.brand} ${item.style || ""}`.trim() : "Wearing a diaper";
  return `<span class="wearing-mark" title="${esc(title)}" aria-label="${esc(title)}">D</span> `;
}

function activeContactId() {
  return document.querySelector("#messageForm select[name='recipient_id']")?.value || "";
}

function messageHousehold(ctx, recipientId) {
  const userId = ctx.session.user.id;
  const rows = ctx.members.filter(member => member.household_id && (member.user_id === userId || member.user_id === recipientId));
  const sharedIds = [...new Set(rows
    .filter(member => member.user_id === userId)
    .map(member => member.household_id)
    .filter(id => rows.some(member => member.household_id === id && member.user_id === recipientId))
  )];
  const writable = sharedIds.find(id => {
    const mine = rows.find(member => member.household_id === id && member.user_id === userId);
    return mine?.role === "owner" || mine?.can_send_messages === true || mine?.households?.owner_id === userId;
  });
  return writable || String(document.querySelector("#messageForm input[name='household_id']")?.value || "");
}

function option(item) {
  return `<option value="${esc(item.id)}">${esc(item.brand)} ${esc(item.style)}${item.size ? ` (${esc(item.size)})` : ""}</option>`;
}

async function patchMessagesUi() {
  const form = document.getElementById("messageForm");
  if (!form) return;
  const ctx = await context();
  if (!ctx) return;
  const contactId = activeContactId();
  const householdId = ownedHousehold(ctx, contactId);
  const friendDiapers = ctx.diapers.filter(item => item.household_id === householdId);
  const diaperSelect = form.elements.diaper_id;
  if (diaperSelect && friendDiapers.length) {
    diaperSelect.closest("label").childNodes[0].textContent = "Friend's diaper / ping";
    diaperSelect.innerHTML = `<option value="">None</option>${friendDiapers.map(option).join("")}`;
  }
  if (!form.elements.check_state) {
    const label = document.createElement("label");
    label.innerHTML = `Check response<select name="check_state"><option value="">Choose when replying</option><option value="wet">Wet</option><option value="dry">Dry</option><option value="messy">Messy</option></select>`;
    form.querySelector(".message-composer-tools")?.insertBefore(label, form.querySelector(".message-photo-field"));
  }
  form.classList.toggle("diaper-check-reply-mode", form.dataset.pendingAction === "diaper_check_reply");
  const topMessageButton = form.querySelector('.message-action-row [value="message"]');
  if (topMessageButton) topMessageButton.hidden = true;
  const replyButton = form.querySelector('.message-action-row [value="diaper_check_reply"]');
  if (replyButton) replyButton.hidden = form.dataset.pendingAction !== "diaper_check_reply";
  const sendButton = form.querySelector('.message-send-row [value="message"]');
  if (sendButton) sendButton.textContent = form.dataset.pendingAction === "diaper_check_reply" ? "Send Check Photo" : "Send";
  document.querySelectorAll("[data-message-contact]").forEach(button => {
    const userId = button.dataset.messageContact;
    const heading = button.querySelector("h4");
    if (heading && userId && !heading.querySelector(".wearing-mark")) heading.innerHTML = `${markText(ctx, userId)}${heading.innerHTML}`;
  });
  const title = document.querySelector(".message-title h3");
  if (title && contactId && !title.querySelector(".wearing-mark")) title.innerHTML = `${markText(ctx, contactId)}${title.innerHTML}`;
}

function imageFileToDataUrl(file) {
  if (!file || !file.type.startsWith("image/")) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image could not be loaded."));
      img.onload = () => {
        const max = 900;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

document.addEventListener("submit", async event => {
  const form = event.target;
  if (form?.id !== "messageForm") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const data = new FormData(form);
  const imageData = await imageFileToDataUrl(data.get("image")).catch(error => {
    toast(error.message);
    return "";
  });
  const ctx = await context();
  if (!ctx) return toast("Please sign in again.");
  const action = form.dataset.pendingAction || event.submitter?.value || "message";
  const recipientId = String(data.get("recipient_id") || "").trim();
  const diaperId = String(data.get("diaper_id") || "").trim();
  let body = String(data.get("body") || "").trim();
  if (!recipientId) return toast("Choose a friend first.");
  if (action === "diaper_ping") {
    if (!diaperId) return toast("Choose a diaper before sending a diaper ping.");
    body = body ? `Diaper ping: ${body}` : "Diaper ping.";
  }
  if (action === "diaper_check") body = diaperCheckRequestText;
  if (action === "diaper_check_reply") {
    const state = String(data.get("check_state") || "").trim().toLowerCase();
    if (!checkStates.has(state)) return toast("Choose wet, dry, or messy for the diaper check reply.");
    if (!imageData) return toast("A diaper check reply needs a photo.");
    body = `${diaperCheckReplyText}: ${state[0].toUpperCase()}${state.slice(1)}.`;
  }
  if (!body && imageData) body = "Photo";
  if (!body) return toast("Add a message or photo before sending.");
  const button = event.submitter || form.querySelector("button[type='submit']");
  const originalText = button?.textContent || "Send";
  if (button) {
    button.disabled = true;
    button.textContent = "Sending...";
  }
  const householdId = messageHousehold(ctx, recipientId);
  const { error } = await supabase.from("messages").insert({
    household_id: householdId,
    sender_id: ctx.session.user.id,
    recipient_id: recipientId,
    body,
    diaper_id: diaperId || null,
    image_data: imageData
  });
  if (error) {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
    return toast(`Message could not send: ${error.message}`);
  }
  delete form.dataset.pendingAction;
  toast(action === "diaper_check_reply" ? "Diaper check reply sent." : "Message sent.");
  document.querySelector('[data-tab="messages"]')?.click();
}, true);

document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="messages"], [data-message-contact], [data-reply-diaper-check]')) {
    setTimeout(() => patchMessagesUi().catch(() => {}), 250);
    setTimeout(() => patchMessagesUi().catch(() => {}), 900);
  }
});

[800, 1800, 3200].forEach(delay => setTimeout(() => patchMessagesUi().catch(() => {}), delay));
