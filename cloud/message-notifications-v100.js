import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const lastMessageKey = "littleFoxLastNotifiedMessage";
const enabledKey = "littleFoxMessageNotifications";
let activeUserId = "";
let channel = null;
let pollTimer = null;

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3200);
}

function canNotify() {
  return "Notification" in window && "serviceWorker" in navigator;
}

function messageText(message) {
  const body = String(message.body || "New message");
  return body.length > 90 ? `${body.slice(0, 87)}...` : body;
}

async function showMessageNotification(message) {
  if (!canNotify() || Notification.permission !== "granted") return;
  const previous = localStorage.getItem(lastMessageKey);
  if (previous === message.id) return;
  localStorage.setItem(lastMessageKey, message.id);

  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (registration?.showNotification) {
    registration.showNotification("Little Fox message", {
      body: messageText(message),
      tag: `little-fox-message-${message.id}`,
      icon: "../assets/sidebar-wag-wag.png",
      badge: "../assets/sidebar-wag-wag.png",
      data: { url: "./#messages" }
    });
  } else {
    new Notification("Little Fox message", {
      body: messageText(message),
      icon: "../assets/sidebar-wag-wag.png"
    });
  }
}

async function newestIncomingMessage(userId) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, body, sender_id, recipient_id, created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null;
  return data?.[0] || null;
}

async function primeLatestMessage(userId) {
  const latest = await newestIncomingMessage(userId);
  if (latest && !localStorage.getItem(lastMessageKey)) {
    localStorage.setItem(lastMessageKey, latest.id);
  }
}

function startPolling(userId) {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const latest = await newestIncomingMessage(userId);
    if (latest) showMessageNotification(latest);
  }, 30000);
}

function startRealtime(userId) {
  if (channel) supabase.removeChannel(channel);
  channel = supabase
    .channel(`little-fox-message-notifications-${userId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${userId}` },
      payload => {
        if (payload.new?.sender_id !== userId) showMessageNotification(payload.new);
      }
    )
    .subscribe();
}

async function startNotifications() {
  if (!canNotify() || Notification.permission !== "granted") return;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId || userId === activeUserId) return;
  activeUserId = userId;
  localStorage.setItem(enabledKey, "true");
  await primeLatestMessage(userId);
  startRealtime(userId);
  startPolling(userId);
}

async function requestNotifications() {
  if (!canNotify()) {
    toast("This browser does not support app notifications.");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    localStorage.setItem(enabledKey, "false");
    toast("Notifications were not enabled.");
    return;
  }
  toast("Message notifications enabled.");
  await startNotifications();
}

function injectNotificationButton() {
  if (!canNotify()) return;
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (!view || !["Settings", "Messages"].includes(title) || document.getElementById("messageNotificationCard")) return;

  const card = document.createElement("article");
  card.className = "card";
  card.id = "messageNotificationCard";
  card.innerHTML = `
    <h3>Message Notifications</h3>
    <p>Get a phone notification when a friend sends a message.</p>
    <button class="btn fox" type="button" id="enableMessageNotifications">
      ${Notification.permission === "granted" ? "Notifications Enabled" : "Enable Notifications"}
    </button>
  `;
  view.appendChild(card);
  card.querySelector("#enableMessageNotifications")?.addEventListener("click", requestNotifications);
}

document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="settings"], [data-tab="messages"]')) {
    setTimeout(injectNotificationButton, 300);
  }
});

window.addEventListener("focus", () => startNotifications());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) startNotifications();
});

[500, 1500, 3000].forEach(delay => setTimeout(() => {
  injectNotificationButton();
  if (localStorage.getItem(enabledKey) === "true") startNotifications();
}, delay));
