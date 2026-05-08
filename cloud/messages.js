import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

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

function can(member, household, userId, permission) {
  return member?.role === "owner" || household?.owner_id === userId || member?.[permission] === true;
}

async function loadContext() {
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
  const [members, diapers, messages] = await Promise.all([
    supabase.from("household_members").select("*").eq("household_id", household.id),
    can(member, household, session.user.id, "can_view_inventory")
      ? supabase.from("diapers").select("*").eq("household_id", household.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    can(member, household, session.user.id, "can_view_messages")
      ? supabase.from("messages").select("*, diapers(brand, style, size)").eq("household_id", household.id).order("created_at", { ascending: false }).limit(80)
      : Promise.resolve({ data: [], error: null })
  ]);
  return {
    session,
    member,
    household,
    members: members.data || [],
    diapers: diapers.data || [],
    messages: messages.data || [],
    messagesError: messages.error
  };
}

function optionHtml(item) {
  return `<option value="${item.id}">${esc(item.brand)} ${esc(item.style)}${item.size ? ` (${esc(item.size)})` : ""}</option>`;
}

function memberName(ctx, userId) {
  const member = ctx.members.find(row => row.user_id === userId);
  if (userId === ctx.session.user.id) return ctx.session.user.email;
  return member?.invite_email || "Household member";
}

function recipientOptions(ctx) {
  return ctx.members
    .filter(member => member.user_id && member.user_id !== ctx.session.user.id && member.status === "active")
    .map(member => `<option value="${esc(member.user_id)}">${esc(member.invite_email || "Household member")}</option>`)
    .join("");
}

function messageItem(ctx, message) {
  const sender = memberName(ctx, message.sender_id);
  const recipient = message.recipient_id ? memberName(ctx, message.recipient_id) : "Everyone";
  const diaper = message.diapers ? `${message.diapers.brand} ${message.diapers.style}${message.diapers.size ? ` (${message.diapers.size})` : ""}` : "";
  return `
    <div class="item">
      <div class="item-head">
        <div><h4>${esc(sender)} to ${esc(recipient)}</h4><p>${esc(new Date(message.created_at).toLocaleString())}</p></div>
        ${diaper ? `<span class="pill viewer">diaper ping</span>` : ""}
      </div>
      <p>${esc(message.body)}</p>
      ${diaper ? `<div class="pill-row"><span class="pill">${esc(diaper)}</span></div>` : ""}
    </div>
  `;
}

async function renderMessages() {
  const ctx = await loadContext();
  const view = document.getElementById("view");
  if (!ctx || !view) return;
  const canView = can(ctx.member, ctx.household, ctx.session.user.id, "can_view_messages");
  const canSend = can(ctx.member, ctx.household, ctx.session.user.id, "can_send_messages");
  document.querySelector(".topbar h2") && (document.querySelector(".topbar h2").textContent = "Messages");
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === "messages"));
  if (!canView) {
    view.innerHTML = `<div class="empty">Messages are hidden for this friend access.</div>`;
    return;
  }
  if (ctx.messagesError) {
    view.innerHTML = `<article class="card"><h3>Messages Setup Needed</h3><p>Run the latest Supabase SQL schema update to enable household messages.</p></article>`;
    return;
  }
  view.innerHTML = `
    ${canSend ? `
      <article class="card">
        <h3>Send Message</h3>
        <form id="messageForm" class="grid" style="margin-top:12px">
          <div class="form-grid">
            <label>Send to<select name="recipient_id"><option value="">Everyone</option>${recipientOptions(ctx)}</select></label>
            <label class="field-full">Message<textarea name="body" required maxlength="1000" placeholder="Write a household message"></textarea></label>
            <label>Optional diaper request<select name="diaper_id"><option value="">No diaper request</option>${ctx.diapers.map(optionHtml).join("")}</select></label>
          </div>
          <button class="btn fox" type="submit">Send Message</button>
        </form>
      </article>
    ` : `<article class="card"><h3>Messages</h3><p>You can read messages, but this friend access cannot send replies.</p></article>`}
    <article class="card" style="margin-top:14px">
      <h3>Household Chat</h3>
      <div class="list" style="margin-top:12px">${ctx.messages.map(message => messageItem(ctx, message)).join("") || `<div class="empty">No messages yet.</div>`}</div>
    </article>
  `;
  document.getElementById("messageForm")?.addEventListener("submit", event => saveMessage(event, ctx));
}

async function saveMessage(event, ctx) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Sending...";
  const { error } = await supabase.from("messages").insert({
    household_id: ctx.household.id,
    sender_id: ctx.session.user.id,
    recipient_id: data.get("recipient_id") || null,
    body: data.get("body").trim(),
    diaper_id: data.get("diaper_id") || null
  });
  if (error) {
    button.disabled = false;
    button.textContent = "Send Message";
    toast(`Message could not send: ${error.message}`);
    return;
  }
  toast("Message sent.");
  renderMessages();
}

async function injectMessagesTab() {
  const ctx = await loadContext();
  const tabs = document.querySelector(".tabs");
  if (!ctx || !tabs || document.querySelector('[data-tab="messages"]')) return;
  if (!can(ctx.member, ctx.household, ctx.session.user.id, "can_view_messages")) return;
  const button = document.createElement("button");
  button.className = "tab";
  button.dataset.tab = "messages";
  button.type = "button";
  button.textContent = "Messages";
  const settings = tabs.querySelector('[data-tab="settings"]');
  tabs.insertBefore(button, settings || null);
  button.addEventListener("click", renderMessages);
}

function injectSettingsHint() {
  const pageTitle = document.querySelector(".topbar h2")?.textContent.trim();
  const inviteForm = document.getElementById("inviteForm");
  if (pageTitle !== "Settings" || !inviteForm || document.getElementById("messagePermissionHint")) return;
  const panel = document.createElement("div");
  panel.id = "messagePermissionHint";
  panel.className = "empty";
  panel.style.marginTop = "10px";
  panel.textContent = "New friends get Messages and message sending enabled by default. Run the latest SQL schema first.";
  inviteForm.appendChild(panel);
}

const observer = new MutationObserver(() => {
  injectMessagesTab();
  injectSettingsHint();
});
observer.observe(document.getElementById("app"), { childList: true, subtree: true });
injectMessagesTab();
