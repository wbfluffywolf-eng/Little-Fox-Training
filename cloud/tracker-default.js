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
  const fromAuth = auth.toLowerCase().startsWith("bearer ") ? decodeJwtSub(auth.slice(7)) : "";
  return fromAuth || window.__littleFoxCurrentUserId || "";
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
  window.__littleFoxCurrentUserId = session.user.id;

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
  // Keep fetch untouched. Network wrappers caused browser-specific auth failures.
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
  document.getElementById("sharedTrackerCard")?.remove();
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
document.addEventListener("click", event => {
  if (event.target.closest("[data-tab], [data-friends-tab]")) setTimeout(injectSharedTrackers, 100);
});

[0, 500, 1500].forEach(delay => setTimeout(injectSharedTrackers, delay));
