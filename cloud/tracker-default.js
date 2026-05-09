import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const selectedKey = "littleFoxSelectedSharedTracker";
const personalKey = "littleFoxPersonalTracker";
const forcePersonalKey = "littleFoxForcePersonalTracker";
const pendingFriendKey = "littleFoxPendingFriendView";

function defaultToPersonalTracker() {
  sessionStorage.removeItem(selectedKey);
  sessionStorage.setItem(forcePersonalKey, "1");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function decodeJwtSub(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).sub || "";
  } catch {
    return "";
  }
}

function headerValue(headers, name) {
  if (!headers) return "";
  if (headers instanceof Headers) return headers.get(name) || "";
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1] || "";
}

function authUserFromRequest(input, init) {
  const headers = init?.headers || input?.headers;
  const auth = headerValue(headers, "authorization");
  return auth.toLowerCase().startsWith("bearer ") ? decodeJwtSub(auth.slice(7)) : "";
}

function sortedMemberships(rows, userId) {
  const selected = sessionStorage.getItem(selectedKey) || "";
  const personal = localStorage.getItem(personalKey) || "";
  const forcePersonal = sessionStorage.getItem(forcePersonalKey) === "1";
  const isPersonal = row => row.id === personal || row.role === "owner" || row.households?.owner_id === userId;
  return [...rows].sort((a, b) => {
    const aPersonal = isPersonal(a) ? 1 : 0;
    const bPersonal = isPersonal(b) ? 1 : 0;
    if (forcePersonal && aPersonal !== bPersonal) return bPersonal - aPersonal;
    const aSelected = !forcePersonal && selected && a.id === selected ? 1 : 0;
    const bSelected = !forcePersonal && selected && b.id === selected ? 1 : 0;
    if (aSelected !== bSelected) return bSelected - aSelected;
    return bPersonal - aPersonal;
  });
}

function withoutKeys(row, keys) {
  const copy = { ...row };
  keys.forEach(key => delete copy[key]);
  return copy;
}

async function insertMemberWithFallback(row) {
  const attempts = [
    row,
    withoutKeys(row, ["can_add_logs"]),
    withoutKeys(row, ["can_add_logs", "can_view_messages", "can_send_messages"]),
    withoutKeys(row, ["can_add_logs", "can_view_messages", "can_send_messages", "can_suggest_diaper"]),
    {
      household_id: row.household_id,
      user_id: row.user_id,
      invite_email: row.invite_email,
      role: row.role,
      status: row.status
    }
  ];
  let lastError = null;
  for (const attempt of attempts) {
    const { data, error } = await supabase.from("household_members").insert(attempt).select().single();
    if (!error) return { data, error: null };
    lastError = error;
    if (!/column|schema cache|could not find|does not exist/i.test(error.message || "")) break;
  }
  return { data: null, error: lastError };
}

async function ensurePersonalTracker() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return;

  const { data: memberships, error } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", session.user.id)
    .eq("status", "active");
  if (error) return;

  const personal = memberships?.find(row => row.role === "owner" || row.households?.owner_id === session.user.id);
  if (personal) {
    localStorage.setItem(personalKey, personal.id);
    return;
  }

  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({ owner_id: session.user.id, name: "My Diaper Tracker" })
    .select()
    .single();
  if (householdError) return;

  const row = {
    household_id: household.id,
    user_id: session.user.id,
    invite_email: session.user.email,
    role: "owner",
    status: "active",
    can_view_dashboard: true,
    can_view_calendar: true,
    can_view_inventory: true,
    can_view_trends: true,
    can_view_expenses: true,
    can_view_settings: true,
    can_suggest_diaper: true,
    can_view_messages: true,
    can_send_messages: true,
    can_add_logs: true
  };
  const { data: member, error: memberError } = await insertMemberWithFallback(row);
  if (!memberError && member?.id) localStorage.setItem(personalKey, member.id);
}

function installMembershipSorter() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    try {
      const url = new URL(typeof input === "string" ? input : input.url);
      const isMembershipFetch = url.hostname.includes("supabase.co") &&
        url.pathname.includes("/household_members") &&
        url.search.includes("households(*)") &&
        url.search.includes("status=eq.active");
      if (!isMembershipFetch || !response.ok) return response;

      const rows = await response.clone().json();
      if (!Array.isArray(rows)) return response;
      const body = JSON.stringify(sortedMemberships(rows, authUserFromRequest(input, init)));
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/json; charset=utf-8");
      return new Response(body, { status: response.status, statusText: response.statusText, headers });
    } catch {
      return response;
    }
  };
}

async function loadSharedMemberships() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return [];
  const { data } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", session.user.id)
    .eq("status", "active");
  const personal = localStorage.getItem(personalKey) || "";
  return (data || []).filter(row => row.id !== personal && row.role !== "owner" && row.households?.owner_id !== session.user.id);
}

function accessLabel(member) {
  const tabs = [
    ["can_view_dashboard", "Dashboard"],
    ["can_view_calendar", "Calendar"],
    ["can_view_inventory", "Inventory"],
    ["can_view_trends", "Trends"],
    ["can_view_expenses", "Expenses"],
    ["can_view_messages", "Messages"]
  ];
  return tabs.filter(([key]) => member[key] === true).map(([, label]) => label).join(", ") || "Limited access";
}

async function injectSharedTrackers() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (title !== "Dashboard" || !view || document.getElementById("sharedTrackerCard")) return;

  const selected = sessionStorage.getItem(selectedKey);
  if (selected) {
    view.insertAdjacentHTML("beforeend", `
      <article class="card" id="sharedTrackerCard" style="margin-top:14px">
        <h3>Shared Diaper Tracker</h3>
        <p>You are viewing a shared tracker. Your own logs stay under My Dashboard.</p>
        <button class="btn secondary" type="button" data-open-my-tracker>My Dashboard</button>
      </article>
    `);
    return;
  }

  const shared = await loadSharedMemberships();
  if (!shared.length || document.getElementById("sharedTrackerCard")) return;
  view.insertAdjacentHTML("beforeend", `
    <article class="card" id="sharedTrackerCard" style="margin-top:14px">
      <h3>Shared Diaper Trackers</h3>
      <div class="list" style="margin-top:12px">
        ${shared.map(member => `
          <div class="item">
            <div class="item-head">
              <div>
                <h4>${esc(member.households?.name || "Shared tracker")}</h4>
                <p>${esc(accessLabel(member))}</p>
              </div>
              <button class="btn secondary" type="button" data-open-shared-tracker="${esc(member.id)}">Open</button>
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `);
}

document.addEventListener("click", event => {
  const sharedButton = event.target.closest("[data-open-shared-tracker]");
  if (sharedButton) {
    defaultToPersonalTracker();
    sessionStorage.setItem(pendingFriendKey, sharedButton.dataset.openSharedTracker);
    location.reload();
    return;
  }

  const personalButton = event.target.closest("[data-open-my-tracker]");
  if (personalButton) {
    defaultToPersonalTracker();
    location.reload();
  }
});

installMembershipSorter();
defaultToPersonalTracker();
await ensurePersonalTracker();
await import("./app.js");
new MutationObserver(injectSharedTrackers).observe(document.getElementById("app"), { childList: true, subtree: true });
setTimeout(injectSharedTrackers, 0);
