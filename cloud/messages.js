import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const selectedKey = "littleFoxSelectedSharedTracker";
const personalKey = "littleFoxPersonalTracker";
const seenKeyPrefix = "littleFoxMessagesSeen";
const activeContactKeyPrefix = "littleFoxActiveMessageContact";

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
  const selectedId = sessionStorage.getItem(selectedKey);
  const personalId = localStorage.getItem(personalKey);
  const ownerMember = (memberships || []).find(row => row.role === "owner" || row.households?.owner_id === session.user.id);
  const member = ownerMember
    || (memberships || []).find(row => row.id === personalId)
    || (memberships || []).find(row => row.id === selectedId)
    || memberships?.[0];
  const household = member?.households;
  if (!member || !household) return null;
  const [members, diapers, messages] = await Promise.all([
    supabase.from("household_members").select("*").eq("household_id", household.id),
    can(member, household, session.user.id, "can_view_inventory")
      ? supabase.from("diapers").select("*").eq("household_id", household.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    can(member, household, session.user.id, "can_view_messages")
      ? supabase.from("messages").select("*, diapers(brand, style, size)").eq("household_id", household.id).order("created_at", { ascending: false }).limit(120)
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
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function memberName(ctx, userId) {
  const member = ctx.members.find(row => row.user_id === userId);
  if (userId === ctx.session.user.id) return ctx.session.user.email;
  return member?.invite_email || "Household member";
}

function recipientOptions(ctx) {
  return messageContacts(ctx)
    .map(member => `<option value="${esc(member.user_id)}">${esc(member.invite_email || "Household member")}</option>`)
    .join("");
}

function messageContacts(ctx) {
  return ctx.members
    .filter(member => member.user_id && member.user_id !== ctx.session.user.id && member.status === "active")
    .sort((a, b) => String(a.invite_email || "").localeCompare(String(b.invite_email || "")));
}

function activeContactKey(householdId) {
  return `${activeContactKeyPrefix}:${householdId}`;
}

function selectedContactId(ctx) {
  const contacts = messageContacts(ctx);
  const saved = sessionStorage.getItem(activeContactKey(ctx.household.id));
  return contacts.some(member => member.user_id === saved) ? saved : contacts[0]?.user_id || "";
}

function setSelectedContact(ctx, userId) {
  if (userId) sessionStorage.setItem(activeContactKey(ctx.household.id), userId);
}

function threadMessages(ctx, contactId) {
  if (!contactId) return [];
  return ctx.messages.filter(message =>
    (message.sender_id === ctx.session.user.id && message.recipient_id === contactId) ||
    (message.sender_id === contactId && message.recipient_id === ctx.session.user.id)
  );
}

function contactList(ctx, activeId) {
  const contacts = messageContacts(ctx);
  return `
    <article class="card message-contacts">
      <h3>Friends</h3>
      <div class="list" style="margin-top:12px">
        ${contacts.map(member => {
          const last = threadMessages(ctx, member.user_id).map(message => message.created_at).sort().pop() || "";
          return `
            <button class="item message-contact ${member.user_id === activeId ? "active" : ""}" type="button" data-message-contact="${esc(member.user_id)}">
              <div class="item-head">
                <div>
                  <h4>${esc(member.invite_email || "Household member")}</h4>
                  <p>${last ? esc(new Date(last).toLocaleString()) : "No private messages yet"}</p>
                </div>
              </div>
            </button>
          `;
        }).join("") || `<div class="empty">Add a friend before messaging.</div>`}
      </div>
    </article>
  `;
}

function seenKey(householdId) {
  return `${seenKeyPrefix}:${householdId}`;
}

function newestIncoming(ctx) {
  return ctx.messages
    .filter(message => message.sender_id !== ctx.session.user.id)
    .filter(message => message.recipient_id === ctx.session.user.id)
    .map(message => message.created_at)
    .sort()
    .pop() || "";
}

function markMessagesSeen(ctx) {
  const newest = newestIncoming(ctx);
  if (newest) localStorage.setItem(seenKey(ctx.household.id), newest);
  updateMessageBadge(ctx);
}

function hasUnread(ctx) {
  const newest = newestIncoming(ctx);
  if (!newest) return false;
  return newest > (localStorage.getItem(seenKey(ctx.household.id)) || "");
}

function updateMessageBadge(ctx) {
  const tab = document.querySelector('[data-tab="messages"]');
  if (!tab || !ctx) return;
  tab.classList.toggle("has-unread", hasUnread(ctx));
  let badge = tab.querySelector(".tab-paw-badge");
  if (hasUnread(ctx)) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "tab-paw-badge";
      badge.textContent = "\uD83D\uDC3E";
      badge.setAttribute("aria-label", "New message");
      tab.appendChild(badge);
    }
  } else {
    badge?.remove();
  }
}

function messageItem(ctx, message) {
  const sender = memberName(ctx, message.sender_id);
  const diaper = message.diapers ? `${message.diapers.brand} ${message.diapers.style}${message.diapers.size ? ` (${message.diapers.size})` : ""}` : "";
  const mine = message.sender_id === ctx.session.user.id;
  return `
    <div class="message-row ${mine ? "mine" : "theirs"}">
      <div class="message-bubble">
        <div class="message-meta">
          <span>${mine ? "You" : esc(sender)}</span>
          <time>${esc(new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))}</time>
        </div>
        <p>${esc(message.body)}</p>
        ${message.image_data ? `<img class="message-image" src="${esc(message.image_data)}" alt="Message attachment">` : ""}
        ${diaper ? `<div class="pill-row"><span class="pill viewer">diaper ping</span><span class="pill">${esc(diaper)}</span></div>` : ""}
      </div>
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
  markMessagesSeen(ctx);
  const activeContact = selectedContactId(ctx);
  const activeContactName = memberName(ctx, activeContact);
  const messages = threadMessages(ctx, activeContact).reverse();
  view.innerHTML = `
    <section class="message-layout">
      ${contactList(ctx, activeContact)}
      <article class="card message-shell">
        <div class="message-title">
          <div>
            <h3>${activeContact ? esc(activeContactName) : "Choose a friend"}</h3>
            <p>${activeContact ? "Private messages between just you two" : "Messages stay private to the selected friend."}</p>
          </div>
          <span class="pill viewer">${messages.length} messages</span>
        </div>
        <div class="message-thread">${messages.map(message => messageItem(ctx, message)).join("") || `<div class="empty">${activeContact ? "No private messages yet." : "Choose a friend to open a private thread."}</div>`}</div>
      </article>
    </section>
    ${canSend ? `
      <article class="card message-composer">
        <form id="messageForm">
          <div class="message-composer-tools">
            <label>To<select name="recipient_id" required>${recipientOptions(ctx)}</select></label>
            <label>Diaper / ping<select name="diaper_id"><option value="">None</option>${ctx.diapers.map(optionHtml).join("")}</select></label>
            <label class="message-photo-field">Photo<input type="file" name="image" accept="image/*"></label>
          </div>
          <div class="message-send-row">
            <textarea name="body" maxlength="1000" rows="2" placeholder="Text a message"></textarea>
            <button class="btn fox" type="submit">Send</button>
          </div>
        </form>
      </article>
    ` : `<article class="card"><h3>Messages</h3><p>You can read messages, but this friend access cannot send replies.</p></article>`}
  `;
  const form = document.getElementById("messageForm");
  if (form?.elements.recipient_id && activeContact) form.elements.recipient_id.value = activeContact;
  form?.addEventListener("submit", event => saveMessage(event, ctx));
  view.querySelectorAll("[data-message-contact]").forEach(button => {
    button.addEventListener("click", () => {
      setSelectedContact(ctx, button.dataset.messageContact);
      renderMessages();
    });
  });
  view.querySelector(".message-thread")?.scrollTo({ top: view.querySelector(".message-thread").scrollHeight });
}

async function saveMessage(event, ctx) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Sending...";
  const imageData = await imageFileToDataUrl(data.get("image")).catch(error => {
    toast(error.message);
    return "";
  });
  const body = String(data.get("body") || "").trim() || (imageData ? "Photo" : "");
  const recipientId = String(data.get("recipient_id") || "").trim();
  if (!body) {
    button.disabled = false;
    button.textContent = "Send";
    toast("Add a message or photo before sending.");
    return;
  }
  if (!recipientId) {
    button.disabled = false;
    button.textContent = "Send";
    toast("Choose a friend first.");
    return;
  }
  const { error } = await supabase.from("messages").insert({
    household_id: ctx.household.id,
    sender_id: ctx.session.user.id,
    recipient_id: recipientId,
    body,
    diaper_id: data.get("diaper_id") || null,
    image_data: imageData || null
  });
  if (error) {
    button.disabled = false;
    button.textContent = "Send";
    if (/image_data|schema cache/i.test(error.message || "")) {
      toast("Run media-schema.sql in Supabase to enable message photos.");
      return;
    }
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
  updateMessageBadge(ctx);
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
setInterval(async () => {
  const ctx = await loadContext().catch(() => null);
  if (ctx && can(ctx.member, ctx.household, ctx.session.user.id, "can_view_messages")) updateMessageBadge(ctx);
}, 30000);
