import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const app = document.getElementById("app");
const toastEl = document.getElementById("toast");

let session = null;
let activeTab = "dashboard";
let context = {
  profile: null,
  household: null,
  member: null,
  members: [],
  diapers: [],
  logs: [],
  expenses: [],
  suggestions: []
};

const tabs = [
  ["dashboard", "Dashboard", "can_view_dashboard"],
  ["calendar", "Calendar", "can_view_calendar"],
  ["inventory", "Inventory", "can_view_inventory"],
  ["trends", "Trends", "can_view_trends"],
  ["expenses", "Expenses", "can_view_expenses"],
  ["settings", "Settings", "can_view_settings"]
];

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function isOwner() {
  return context.member?.role === "owner" || context.household?.owner_id === session?.user?.id;
}

function can(permission) {
  return isOwner() || context.member?.[permission] === true;
}

function setApp(html) {
  app.innerHTML = html;
}

async function init() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  if (!session) {
    renderAuth();
    return;
  }
  await loadCloudState();
  renderShell();
}

function renderAuth() {
  setApp(`
    <section class="auth-card">
      <h1>Little Fox Training Cloud</h1>
      <p>Secure account login for owner and restricted friend access.</p>
      <form id="authForm" class="grid">
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
        <button class="btn fox" name="mode" value="signin" type="submit">Sign In</button>
        <button class="btn secondary" name="mode" value="signup" type="submit">Create Account</button>
      </form>
    </section>
  `);
  document.getElementById("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const submitter = event.submitter;
    const form = new FormData(event.currentTarget);
    const email = form.get("email").trim();
    const password = form.get("password");
    const authCall = submitter.value === "signup"
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password });
    const { data, error } = await authCall;
    if (error) {
      toast(error.message);
      return;
    }
    session = data.session;
    if (!session) {
      toast("Check your email to confirm your account, then sign in.");
      return;
    }
    await loadCloudState();
    renderShell();
  });
}

async function loadCloudState() {
  const user = session.user;
  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    display_name: user.email?.split("@")[0] || "Little Fox"
  });

  await acceptMatchingInvites(user.email);

  const { data: memberships, error: memberError } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (memberError) throw memberError;

  if (!memberships?.length) {
    const { data: household, error: householdError } = await supabase
      .from("households")
      .insert({ owner_id: user.id, name: "Little Fox Training" })
      .select()
      .single();
    if (householdError) throw householdError;

    const { data: member, error: insertMemberError } = await supabase
      .from("household_members")
      .insert({
        household_id: household.id,
        user_id: user.id,
        invite_email: user.email,
        role: "owner",
        status: "active",
        can_view_dashboard: true,
        can_view_calendar: true,
        can_view_inventory: true,
        can_view_trends: true,
        can_view_expenses: true,
        can_view_settings: true,
        can_suggest_diaper: true,
        can_add_logs: true
      })
      .select()
      .single();
    if (insertMemberError) throw insertMemberError;
    context.household = household;
    context.member = member;
  } else {
    context.member = memberships[0];
    context.household = memberships[0].households;
  }

  await loadHouseholdData();
}

async function acceptMatchingInvites(email) {
  const { data: pending } = await supabase
    .from("household_members")
    .select("id")
    .ilike("invite_email", email)
    .is("user_id", null)
    .eq("status", "pending");
  if (!pending?.length) return;
  await Promise.all(pending.map(row =>
    supabase.from("household_members").update({ user_id: session.user.id, status: "active" }).eq("id", row.id)
  ));
}

async function loadHouseholdData() {
  const householdId = context.household.id;
  const requests = [
    supabase.from("household_members").select("*").eq("household_id", householdId),
    can("can_view_inventory") ? supabase.from("diapers").select("*").eq("household_id", householdId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    (can("can_view_calendar") || can("can_view_trends")) ? supabase.from("logs").select("*").eq("household_id", householdId).order("happened_at", { ascending: false }) : Promise.resolve({ data: [] }),
    can("can_view_expenses") ? supabase.from("expenses").select("*").eq("household_id", householdId).order("expense_date", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("diaper_suggestions").select("*, diapers(brand, style, size)").eq("household_id", householdId).order("created_at", { ascending: false })
  ];
  const [members, diapers, logs, expenses, suggestions] = await Promise.all(requests);
  context.members = members.data || [];
  context.diapers = diapers.data || [];
  context.logs = logs.data || [];
  context.expenses = expenses.data || [];
  context.suggestions = suggestions.data || [];
}

function renderShell() {
  const allowedTabs = tabs.filter(([, , permission]) => can(permission));
  if (!allowedTabs.some(([id]) => id === activeTab)) activeTab = allowedTabs[0]?.[0] || "dashboard";
  setApp(`
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">
          <h1>Little Fox Training</h1>
          <p>${esc(context.household.name)}<br>${isOwner() ? "Owner" : "Restricted friend view"}</p>
        </div>
        <nav class="tabs">
          ${tabs.map(([id, label, permission]) => `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}" ${can(permission) ? "" : "hidden"}>${label}</button>`).join("")}
        </nav>
        <button class="btn secondary" id="signOutBtn">Sign Out</button>
      </aside>
      <section class="main">
        <div class="topbar">
          <div>
            <h2>${esc(tabs.find(([id]) => id === activeTab)?.[1] || "Dashboard")}</h2>
            <p>${isOwner() ? "Full access" : "Read-only friend access"}</p>
          </div>
          ${!isOwner() && canSuggest() ? `<button class="btn fox" data-tab="inventory">Suggest Diaper</button>` : ""}
        </div>
        <div id="view"></div>
      </section>
    </div>
  `);
  document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => {
    activeTab = btn.dataset.tab;
    renderShell();
  }));
  document.getElementById("signOutBtn").addEventListener("click", async () => {
    await supabase.auth.signOut();
    session = null;
    renderAuth();
  });
  renderActiveView();
}

function canSuggest() {
  return isOwner() || context.member?.can_suggest_diaper;
}

function renderActiveView() {
  const view = document.getElementById("view");
  const renderers = {
    dashboard: renderDashboard,
    calendar: renderCalendar,
    inventory: renderInventory,
    trends: renderTrends,
    expenses: renderExpenses,
    settings: renderSettings
  };
  view.innerHTML = renderers[activeTab]?.() || `<div class="empty">No access.</div>`;
  bindViewEvents();
}

function renderDashboard() {
  const wet = context.logs.filter(log => log.event === "wet").length;
  const messed = context.logs.filter(log => log.event === "messed").length;
  const leaks = context.logs.filter(log => log.leaked).length;
  return `
    <div class="grid three">
      ${stat("Inventory", context.diapers.length, "visible items")}
      ${stat("Wet", wet, "logged events")}
      ${stat("Messed", messed, `${leaks} leaks`)}
    </div>
    ${renderSuggestions()}
  `;
}

function stat(title, value, sub) {
  return `<article class="card"><h3>${esc(title)}</h3><h2>${esc(value)}</h2><p>${esc(sub)}</p></article>`;
}

function renderCalendar() {
  if (!context.logs.length) return `<div class="empty">No visible logs yet.</div>`;
  return `<div class="list">${context.logs.map(log => `
    <div class="item">
      <div class="item-head"><div><h4>${esc(log.event)}</h4><p>${new Date(log.happened_at).toLocaleString()}</p></div></div>
      <div class="pill-row">${log.leaked ? `<span class="pill alert">leaked</span>` : ""}${log.accident ? `<span class="pill alert">accident</span>` : ""}</div>
      ${log.notes ? `<p>${esc(log.notes)}</p>` : ""}
    </div>
  `).join("")}</div>`;
}

function renderInventory() {
  return `
    ${isOwner() ? `
      <article class="card">
        <h3>Add Inventory Item</h3>
        <form id="diaperForm" class="grid">
          <div class="form-grid">
            <label>Brand<input name="brand" required></label>
            <label>Style<input name="style" required></label>
            <label>Size<input name="size"></label>
            <label>Type<select name="item_type"><option value="disposable">Disposable</option><option value="disposable_insert">Disposable insert</option><option value="cloth">Cloth</option><option value="cloth_insert">Cloth insert</option><option value="underpad">Underpad</option></select></label>
            <label>Stock count<input name="stock_count" type="number" min="0" value="0"></label>
            <label>Purchase price<input name="purchase_price" type="number" min="0" step="0.01" value="0"></label>
          </div>
          <button class="btn fox" type="submit">Save Item</button>
        </form>
      </article>
    ` : ""}
    <section class="grid two" style="margin-top:14px">
      <article class="card">
        <h3>Inventory</h3>
        <div class="list" style="margin-top:12px">${context.diapers.length ? context.diapers.map(renderDiaper).join("") : `<div class="empty">No visible inventory.</div>`}</div>
      </article>
      ${canSuggest() ? renderSuggestCard() : ""}
    </section>
  `;
}

function renderDiaper(item) {
  return `
    <div class="item">
      <div class="item-head">
        <div><h4>${esc(item.brand)} ${esc(item.style)}</h4><p>${esc(item.size || "No size")} - ${esc(item.item_type)}</p></div>
        <strong>${item.stock_count}</strong>
      </div>
      <div class="pill-row"><span class="pill">${money(item.purchase_price)}</span>${isOwner() ? `<button class="btn secondary" data-delete-diaper="${item.id}">Delete</button>` : ""}</div>
    </div>
  `;
}

function renderSuggestCard() {
  return `
    <article class="card">
      <h3>Suggest Diaper</h3>
      <p>Friends can ping a suggestion without editing inventory or logs.</p>
      <form id="suggestForm" class="grid" style="margin-top:12px">
        <label>Diaper<select name="diaper_id">${context.diapers.map(item => `<option value="${item.id}">${esc(item.brand)} ${esc(item.style)}</option>`).join("")}</select></label>
        <label>Note<textarea name="note" placeholder="Optional note"></textarea></label>
        <button class="btn sky" type="submit" ${context.diapers.length ? "" : "disabled"}>Send Suggestion</button>
      </form>
    </article>
  `;
}

function renderSuggestions() {
  if (!context.suggestions.length) return "";
  return `
    <article class="card" style="margin-top:14px">
      <h3>Diaper Suggestions</h3>
      <div class="list" style="margin-top:12px">${context.suggestions.map(suggestion => `
        <div class="item">
          <div class="item-head">
            <div><h4>${esc(suggestion.diapers ? `${suggestion.diapers.brand} ${suggestion.diapers.style}` : "Deleted diaper")}</h4><p>${esc(suggestion.note || "No note")}</p></div>
            <span class="pill ${suggestion.status === "new" ? "viewer" : "owner"}">${esc(suggestion.status)}</span>
          </div>
          ${isOwner() && suggestion.status === "new" ? `<div class="pill-row"><button class="btn secondary" data-suggestion-status="${suggestion.id}" data-status="accepted">Accept</button><button class="btn secondary" data-suggestion-status="${suggestion.id}" data-status="dismissed">Dismiss</button></div>` : ""}
        </div>
      `).join("")}</div>
    </article>
  `;
}

function renderTrends() {
  const byEvent = Object.groupBy ? Object.groupBy(context.logs, log => log.event) : {};
  const wet = byEvent.wet?.length || context.logs.filter(log => log.event === "wet").length;
  const messed = byEvent.messed?.length || context.logs.filter(log => log.event === "messed").length;
  const dry = byEvent.dry?.length || context.logs.filter(log => log.event === "dry").length;
  return `<div class="grid three">${stat("Wet", wet, "events")}${stat("Messed", messed, "events")}${stat("Dry", dry, "events")}</div>`;
}

function renderExpenses() {
  const total = context.expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return `
    ${stat("Total Expenses", money(total), `${context.expenses.length} visible rows`)}
    <div class="list" style="margin-top:14px">${context.expenses.length ? context.expenses.map(row => `
      <div class="item"><div class="item-head"><div><h4>${esc(row.item)}</h4><p>${esc(row.category)} - ${esc(row.brand || "Other")}</p></div><strong>${money(row.amount)}</strong></div></div>
    `).join("") : `<div class="empty">No visible expenses.</div>`}</div>
  `;
}

function renderSettings() {
  if (!isOwner()) return `<div class="empty">Settings are hidden for restricted viewers.</div>`;
  return `
    <div class="grid two">
      <article class="card">
        <h3>Invite Friend</h3>
        <p>Invite a friend and choose exactly what they can see.</p>
        <form id="inviteForm" class="grid" style="margin-top:12px">
          <label>Email<input name="email" type="email" required></label>
          <div class="form-grid">
            ${permissionCheckbox("can_view_dashboard", "Dashboard", true)}
            ${permissionCheckbox("can_view_calendar", "Calendar", true)}
            ${permissionCheckbox("can_view_inventory", "Inventory", true)}
            ${permissionCheckbox("can_view_trends", "Trends", true)}
            ${permissionCheckbox("can_view_expenses", "Expenses", false)}
            ${permissionCheckbox("can_view_settings", "Settings", false)}
            ${permissionCheckbox("can_suggest_diaper", "Can suggest diaper", true)}
          </div>
          <button class="btn fox" type="submit">Create Invite</button>
        </form>
      </article>
      <article class="card">
        <h3>Members</h3>
        <div class="list" style="margin-top:12px">${context.members.map(member => `
          <div class="item">
            <div class="item-head"><div><h4>${esc(member.invite_email || member.user_id)}</h4><p>${esc(member.status)} - ${esc(member.role)}</p></div><span class="pill ${member.role === "owner" ? "owner" : "viewer"}">${esc(member.role)}</span></div>
            ${member.role !== "owner" ? `<button class="btn danger" data-revoke-member="${member.id}">Revoke</button>` : ""}
          </div>
        `).join("")}</div>
      </article>
    </div>
  `;
}

function permissionCheckbox(name, label, checked) {
  return `<label><span><input type="checkbox" name="${name}" ${checked ? "checked" : ""}> ${label}</span></label>`;
}

function bindViewEvents() {
  document.getElementById("diaperForm")?.addEventListener("submit", saveDiaper);
  document.getElementById("suggestForm")?.addEventListener("submit", saveSuggestion);
  document.getElementById("inviteForm")?.addEventListener("submit", saveInvite);
  document.querySelectorAll("[data-delete-diaper]").forEach(btn => btn.addEventListener("click", () => deleteDiaper(btn.dataset.deleteDiaper)));
  document.querySelectorAll("[data-suggestion-status]").forEach(btn => btn.addEventListener("click", () => updateSuggestion(btn.dataset.suggestionStatus, btn.dataset.status)));
  document.querySelectorAll("[data-revoke-member]").forEach(btn => btn.addEventListener("click", () => revokeMember(btn.dataset.revokeMember)));
}

async function saveDiaper(event) {
  event.preventDefault();
  if (!isOwner()) return;
  const data = new FormData(event.currentTarget);
  const { error } = await supabase.from("diapers").insert({
    household_id: context.household.id,
    brand: data.get("brand").trim(),
    style: data.get("style").trim(),
    size: data.get("size").trim(),
    item_type: data.get("item_type"),
    stock_count: Number(data.get("stock_count") || 0),
    purchase_price: Number(data.get("purchase_price") || 0)
  });
  if (error) return toast(error.message);
  await loadHouseholdData();
  renderShell();
  toast("Inventory item saved.");
}

async function deleteDiaper(id) {
  if (!isOwner()) return;
  const { error } = await supabase.from("diapers").delete().eq("id", id);
  if (error) return toast(error.message);
  await loadHouseholdData();
  renderShell();
}

async function saveSuggestion(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const { error } = await supabase.from("diaper_suggestions").insert({
    household_id: context.household.id,
    diaper_id: data.get("diaper_id"),
    suggested_by: session.user.id,
    note: data.get("note").trim()
  });
  if (error) return toast(error.message);
  await loadHouseholdData();
  renderShell();
  toast("Suggestion sent.");
}

async function updateSuggestion(id, status) {
  if (!isOwner()) return;
  const { error } = await supabase.from("diaper_suggestions").update({ status }).eq("id", id);
  if (error) return toast(error.message);
  await loadHouseholdData();
  renderShell();
}

async function saveInvite(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const row = {
    household_id: context.household.id,
    invite_email: data.get("email").trim().toLowerCase(),
    role: "viewer",
    status: "pending",
    can_view_dashboard: data.has("can_view_dashboard"),
    can_view_calendar: data.has("can_view_calendar"),
    can_view_inventory: data.has("can_view_inventory"),
    can_view_trends: data.has("can_view_trends"),
    can_view_expenses: data.has("can_view_expenses"),
    can_view_settings: data.has("can_view_settings"),
    can_suggest_diaper: data.has("can_suggest_diaper"),
    can_add_logs: false
  };
  const { error } = await supabase.from("household_members").insert(row);
  if (error) return toast(error.message);
  await loadHouseholdData();
  renderShell();
  toast("Invite created. Ask them to sign up with that email.");
}

async function revokeMember(id) {
  const { error } = await supabase.from("household_members").update({ status: "revoked" }).eq("id", id);
  if (error) return toast(error.message);
  await loadHouseholdData();
  renderShell();
}

supabase.auth.onAuthStateChange((_event, nextSession) => {
  session = nextSession;
});

init().catch(error => {
  console.error(error);
  setApp(`<section class="auth-card"><h1>Setup needed</h1><p>${esc(error.message)}</p><p>Make sure the Supabase SQL schema has been run.</p></section>`);
});
