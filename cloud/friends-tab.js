import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const selectedKey = "littleFoxSelectedSharedTracker";
const personalKey = "littleFoxPersonalTracker";
const forcePersonalKey = "littleFoxForcePersonalTracker";
const openLogKey = "littleFoxOpenPersonalLog";
const pendingFriendKey = "littleFoxPendingFriendView";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2800);
}

function can(member, permission) {
  return member?.role === "owner" || member?.[permission] === true;
}

function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, ch => ch.toUpperCase());
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

async function sessionUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

async function loadMemberships() {
  const user = await sessionUser();
  if (!user) return { user: null, personal: null, shared: [], incoming: [] };
  const { data, error } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", user.id)
    .in("status", ["active", "pending"]);
  if (error) throw error;
  const personalId = localStorage.getItem(personalKey) || "";
  const active = (data || []).filter(row => row.status === "active");
  const personal = active.find(row => row.id === personalId || row.role === "owner" || row.households?.owner_id === user.id);
  const shared = active.filter(row => row.id !== personal?.id && row.role !== "owner" && row.households?.owner_id !== user.id && row.households);
  const incoming = (data || []).filter(row => row.status === "pending" && row.role !== "owner" && row.households?.owner_id !== user.id && row.households);
  return { user, personal, shared, incoming };
}

function mutualDiaperPermissions() {
  return {
    can_view_dashboard: true,
    can_view_calendar: true,
    can_view_inventory: true,
    can_view_trends: true,
    can_view_expenses: false,
    can_view_messages: true,
    can_send_messages: true,
    can_view_settings: false,
    can_suggest_diaper: true,
    can_add_logs: false
  };
}

function accessText(member) {
  const items = [
    ["can_suggest_diaper", "Diaper pings"],
    ["can_view_inventory", "Diaper stock"],
    ["can_view_trends", "Diaper usage"],
    ["can_view_expenses", "Expenses"],
    ["can_view_calendar", "Calendar"],
    ["can_view_messages", "Messages"]
  ];
  return items.filter(([key]) => member[key] === true).map(([, text]) => text).join(", ") || "Limited view";
}

function friendListHtml(ctx) {
  return `
    <article class="card">
      <div class="item-head">
        <div>
          <h3>My Diaper Tracker</h3>
          <p>Your own logs and inventory stay separate from friend views.</p>
        </div>
        <div class="pill-row">
          <button class="btn fox" type="button" data-friends-my-log>Log My Diaper</button>
          <button class="btn secondary" type="button" data-friends-my-dashboard>My Dashboard</button>
        </div>
      </div>
    </article>
    ${ctx.incoming.length ? `
      <article class="card" style="margin-top:14px">
        <h3>Friend Requests</h3>
        <div class="list" style="margin-top:12px">
          ${ctx.incoming.map(member => `
            <div class="item">
              <div class="item-head">
                <div>
                  <h4>${esc(member.households?.name || member.invite_email || "Friend request")}</h4>
                  <p>Accept to share diaper-use views with each other, or deny to remove the request.</p>
                </div>
                <div class="pill-row">
                  <button class="btn fox" type="button" data-friend-accept="${esc(member.id)}">Accept</button>
                  <button class="btn secondary" type="button" data-friend-deny="${esc(member.id)}">Deny</button>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </article>
    ` : ""}
    <article class="card" style="margin-top:14px">
      <h3>Friends</h3>
      <div class="list" style="margin-top:12px">
        ${ctx.shared.map(member => `
          <div class="item">
            <div class="item-head">
              <div>
                <h4>${esc(member.households?.name || member.invite_email || "Friend")}</h4>
                <p>${esc(accessText(member))}</p>
              </div>
              <button class="btn secondary" type="button" data-friend-view="${esc(member.id)}">View</button>
            </div>
          </div>
        `).join("") || `<div class="empty">No friends have shared a tracker with you yet.</div>`}
      </div>
    </article>
  `;
}

async function loadFriendData(member) {
  const householdId = member.household_id;
  const requests = [
    can(member, "can_view_inventory")
      ? supabase.from("diapers").select("*").eq("household_id", householdId).order("created_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] }),
    can(member, "can_view_calendar") || can(member, "can_view_trends")
      ? supabase.from("logs").select("*, diapers(brand, style, size)").eq("household_id", householdId).order("happened_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    can(member, "can_view_expenses")
      ? supabase.from("expenses").select("*").eq("household_id", householdId).order("expense_date", { ascending: false }).limit(80)
      : Promise.resolve({ data: [] })
  ];
  const [diapers, logs, expenses] = await Promise.all(requests);
  if (diapers.error) throw diapers.error;
  if (logs.error) throw logs.error;
  if (expenses.error) throw expenses.error;
  return { diapers: diapers.data || [], logs: logs.data || [], expenses: expenses.data || [] };
}

function pingCard(member, data) {
  if (!member.can_suggest_diaper) return "";
  const options = data.diapers
    .filter(item => item.item_type === "disposable" || item.item_type === "cloth")
    .map(item => `<option value="${esc(item.id)}">${esc(item.brand)} ${esc(item.style)}${item.size ? ` (${esc(item.size)})` : ""}</option>`)
    .join("");
  return `
    <article class="card" style="margin-top:14px">
      <h3>Send Diaper Ping</h3>
      <form id="friendPingForm" class="grid" style="margin-top:12px" data-household-id="${esc(member.household_id)}">
        <label>Diaper request<select name="diaper_id" required>${options}</select></label>
        <label>Message<textarea name="note" rows="3" placeholder="Optional message"></textarea></label>
        <button class="btn fox" type="submit" ${options ? "" : "disabled"}>Send Ping</button>
      </form>
    </article>
  `;
}

function statsCard(data) {
  const hasType = (log, type) => log.event === type || log[`${type}_event`] === true || (Array.isArray(log.event_types) && log.event_types.includes(type));
  const wet = data.logs.filter(log => hasType(log, "wet")).length;
  const messed = data.logs.filter(log => hasType(log, "messed")).length;
  const leaks = data.logs.filter(log => log.leaked).length;
  return `<article class="card" style="margin-top:14px"><h3>Diaper Usage</h3><div class="grid three" style="margin-top:12px"><article class="card"><h3>Wet</h3><h2>${wet}</h2><p>visible logs</p></article><article class="card"><h3>Messed</h3><h2>${messed}</h2><p>visible logs</p></article><article class="card"><h3>Leaks</h3><h2>${leaks}</h2><p>visible logs</p></article></div></article>`;
}

function inventoryCard(data) {
  return `
    <article class="card" style="margin-top:14px">
      <h3>Diaper Stock</h3>
      <div class="list" style="margin-top:12px">
        ${data.diapers.map(item => `<div class="item"><div class="item-head"><div><h4>${esc(item.brand)} ${esc(item.style)}</h4><p>${esc(item.size || item.item_type || "No size")}</p></div><strong>${Number(item.stock_count || 0)}</strong></div></div>`).join("") || `<div class="empty">Inventory is hidden or empty.</div>`}
      </div>
    </article>
  `;
}

function logsCard(data) {
  return `
    <article class="card" style="margin-top:14px">
      <h3>Calendar View</h3>
      <div class="list" style="margin-top:12px">
        ${data.logs.slice(0, 12).map(log => `<div class="item"><div class="item-head"><div><h4>${esc(label(log.event))} on ${esc(new Date(log.happened_at || log.changed_at).toLocaleString())}</h4><p>${esc(log.diapers ? `${log.diapers.brand} ${log.diapers.style}` : "No diaper selected")}</p></div></div><div class="pill-row">${log.subcategory ? `<span class="pill">${esc(label(log.subcategory))}</span>` : ""}${log.leaked ? `<span class="pill alert">Leaked</span>` : ""}${log.accident ? `<span class="pill alert">Accident</span>` : ""}</div></div>`).join("") || `<div class="empty">Calendar/logs are hidden or empty.</div>`}
      </div>
    </article>
  `;
}

function expensesCard(data) {
  const total = data.expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return `<article class="card" style="margin-top:14px"><h3>Expenses</h3><h2>${money(total)}</h2><p>${data.expenses.length} visible expense rows</p></article>`;
}

function friendViewHtml(member, data) {
  return `
    <article class="card">
      <div class="item-head">
        <div>
          <h3>${esc(member.households?.name || "Friend Tracker")}</h3>
          <p>${esc(accessText(member))}</p>
        </div>
        <button class="btn secondary" type="button" data-friends-back>Back to Friends</button>
      </div>
    </article>
    ${pingCard(member, data)}
    ${can(member, "can_view_inventory") ? inventoryCard(data) : ""}
    ${can(member, "can_view_dashboard") || can(member, "can_view_trends") ? statsCard(data) : ""}
    ${can(member, "can_view_expenses") ? expensesCard(data) : ""}
    ${can(member, "can_view_calendar") ? logsCard(data) : ""}
  `;
}

async function renderFriends() {
  const view = document.getElementById("view");
  if (!view) return;
  const title = document.querySelector(".topbar h2");
  const subtitle = document.querySelector(".topbar p");
  if (title) title.textContent = "Friends";
  if (subtitle) subtitle.textContent = "Friends and shared tracker permissions";
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.friendsTab === "true"));

  const ctx = await loadMemberships();
  if (!ctx.user) {
    view.innerHTML = `<div class="empty">Sign in to view friends.</div>`;
    return;
  }
  view.innerHTML = friendListHtml(ctx);
  bindFriendsList(ctx);
  const pendingFriend = sessionStorage.getItem(pendingFriendKey);
  if (pendingFriend) {
    sessionStorage.removeItem(pendingFriendKey);
    [...view.querySelectorAll("[data-friend-view]")].find(button => button.dataset.friendView === pendingFriend)?.click();
  }
}

function bindFriendsList(ctx) {
  const view = document.getElementById("view");
  view.querySelector("[data-friends-my-log]")?.addEventListener("click", () => {
    sessionStorage.removeItem(selectedKey);
    sessionStorage.setItem(forcePersonalKey, "1");
    sessionStorage.setItem(openLogKey, "1");
    location.reload();
  });
  view.querySelector("[data-friends-my-dashboard]")?.addEventListener("click", () => {
    sessionStorage.removeItem(selectedKey);
    sessionStorage.setItem(forcePersonalKey, "1");
    location.reload();
  });
  view.querySelectorAll("[data-friend-view]").forEach(button => {
    button.addEventListener("click", async () => {
      const member = ctx.shared.find(row => row.id === button.dataset.friendView);
      if (!member) return;
      sessionStorage.removeItem(forcePersonalKey);
      const data = await loadFriendData(member);
      view.innerHTML = friendViewHtml(member, data);
      bindFriendView(member);
    });
  });
  view.querySelectorAll("[data-friend-accept]").forEach(button => {
    button.addEventListener("click", async () => {
      const member = ctx.incoming.find(row => row.id === button.dataset.friendAccept);
      if (!member) return;
      button.disabled = true;
      button.textContent = "Accepting...";
      try {
        await acceptFriendRequest(ctx, member);
        toast("Friend request accepted.");
        await renderFriends();
      } catch (error) {
        toast(error.message || "Friend request could not be accepted.");
        button.disabled = false;
        button.textContent = "Accept";
      }
    });
  });
  view.querySelectorAll("[data-friend-deny]").forEach(button => {
    button.addEventListener("click", async () => {
      const member = ctx.incoming.find(row => row.id === button.dataset.friendDeny);
      if (!member) return;
      button.disabled = true;
      button.textContent = "Denying...";
      try {
        await denyFriendRequest(ctx, member);
        toast("Friend request denied.");
        await renderFriends();
      } catch (error) {
        toast(error.message || "Friend request could not be denied.");
        button.disabled = false;
        button.textContent = "Deny";
      }
    });
  });
}

async function acceptFriendRequest(ctx, member) {
  if (!ctx.personal?.household_id) throw new Error("Your personal tracker was not found.");
  const requesterId = member.households?.owner_id;
  if (!requesterId) throw new Error("The friend request owner was not found.");
  const permissions = mutualDiaperPermissions();

  const accepted = await supabase
    .from("household_members")
    .update({ status: "active" })
    .eq("id", member.id)
    .eq("user_id", ctx.user.id);
  if (accepted.error) throw accepted.error;

  let { data: existing, error: lookupError } = await supabase
    .from("household_members")
    .select("id")
    .eq("household_id", ctx.personal.household_id)
    .eq("user_id", requesterId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const reciprocal = {
    household_id: ctx.personal.household_id,
    user_id: requesterId,
    role: "viewer",
    status: "active",
    ...permissions
  };

  const result = existing?.id
    ? await supabase.from("household_members").update(reciprocal).eq("id", existing.id)
    : await supabase.from("household_members").insert(reciprocal);
  if (result.error) throw result.error;
}

async function denyFriendRequest(ctx, member) {
  const denied = await supabase
    .from("household_members")
    .update({ status: "revoked" })
    .eq("id", member.id)
    .eq("user_id", ctx.user.id)
    .eq("status", "pending");
  if (denied.error) throw denied.error;
}

function bindFriendView(member) {
  const view = document.getElementById("view");
  view.querySelector("[data-friends-back]")?.addEventListener("click", renderFriends);
  view.querySelector("#friendPingForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const user = await sessionUser();
    const data = new FormData(event.currentTarget);
    const { error } = await supabase.from("diaper_suggestions").insert({
      household_id: member.household_id,
      diaper_id: data.get("diaper_id"),
      suggested_by: user.id,
      note: String(data.get("note") || "").trim()
    });
    if (error) return toast(`Ping could not send: ${error.message}`);
    event.currentTarget.reset();
    toast("Diaper ping sent.");
  });
}

function injectFriendsTab() {
  const tabs = document.querySelector(".tabs");
  if (!tabs || document.querySelector("[data-friends-tab]")) return;
  const button = document.createElement("button");
  button.className = "tab";
  button.type = "button";
  button.dataset.friendsTab = "true";
  button.textContent = "Friends";
  const social = tabs.querySelector("[data-public-tab]");
  const messages = tabs.querySelector('[data-tab="messages"]');
  const settings = tabs.querySelector('[data-tab="settings"]');
  tabs.insertBefore(button, social || messages || settings || null);
  button.addEventListener("click", renderFriends);
}

function openPendingPersonalLog() {
  if (sessionStorage.getItem(openLogKey) !== "1") return;
  if (sessionStorage.getItem(forcePersonalKey) === "1") sessionStorage.removeItem(selectedKey);
  if (sessionStorage.getItem(selectedKey)) return;
  const tab = document.querySelector('[data-tab="log"]');
  if (!tab) return;
  sessionStorage.removeItem(openLogKey);
  tab.click();
}

function openPendingFriendView() {
  if (!sessionStorage.getItem(pendingFriendKey)) return;
  document.querySelector("[data-friends-tab]")?.click();
}

function bootFriendsTab() {
  injectFriendsTab();
  openPendingFriendView();
  openPendingPersonalLog();
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-tab], [data-public-tab]")) setTimeout(bootFriendsTab, 100);
});

bootFriendsTab();
[500, 1500, 3000].forEach(delay => setTimeout(bootFriendsTab, delay));
