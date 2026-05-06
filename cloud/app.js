import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const app = document.getElementById("app");
const toastEl = document.getElementById("toast");

let session = null;
let activeTab = "dashboard";
let context = {
  household: null,
  member: null,
  members: [],
  diapers: [],
  logs: [],
  expenses: [],
  suggestions: []
};

const navTabs = [
  ["dashboard", "Dashboard", "can_view_dashboard"],
  ["log", "Daily Log", "can_view_calendar"],
  ["inventory", "Inventory", "can_view_inventory"],
  ["calendar", "Calendar", "can_view_calendar"],
  ["trends", "Trends", "can_view_trends"],
  ["cloth", "Cloth Diapers", "can_view_inventory"],
  ["expenses", "Expenses", "can_view_expenses"],
  ["settings", "Settings", "can_view_settings"]
];

const logSubcategories = [
  ["daytime", "Daytime"],
  ["while_sleeping", "While sleeping"],
  ["before_bed", "Before bed"],
  ["morning_change", "Morning change"],
  ["night_change", "Night change"],
  ["leaked_in_bed", "Leaked in bed"],
  ["leaked_while_awake", "Leaked while awake"],
  ["night_accident", "Night accident"],
  ["day_accident", "Day accident"]
];

const itemTypes = {
  disposable: "Disposable diaper",
  disposable_insert: "Disposable insert",
  cloth: "Cloth diaper",
  cloth_insert: "Cloth insert",
  underpad: "Underpad"
};

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function money(value) { return `$${Number(value || 0).toFixed(2)}`; }
function dt(value) { return value ? new Date(value).toLocaleString() : ""; }

function dateTimeLocal(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isOwner() { return context.member?.role === "owner" || context.household?.owner_id === session?.user?.id; }
function can(permission) { return isOwner() || context.member?.[permission] === true; }
function canSuggest() { return isOwner() || context.member?.can_suggest_diaper; }
function setApp(html) { app.innerHTML = html; }

async function init() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  if (!session) return renderAuth();
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
    </section>`);
  document.getElementById("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const authCall = event.submitter.value === "signup"
      ? supabase.auth.signUp({ email: form.get("email").trim(), password: form.get("password") })
      : supabase.auth.signInWithPassword({ email: form.get("email").trim(), password: form.get("password") });
    const { data, error } = await authCall;
    if (error) return toast(error.message);
    session = data.session;
    if (!session) return toast("Check your email to confirm your account, then sign in.");
    await loadCloudState();
    renderShell();
  });
}

async function loadCloudState() {
  const user = session.user;
  await supabase.from("profiles").upsert({ id: user.id, email: user.email, display_name: user.email?.split("@")[0] || "Little Fox" });
  await acceptMatchingInvites(user.email);
  const { data: memberships, error } = await supabase.from("household_members").select("*, households(*)").eq("user_id", user.id).eq("status", "active");
  if (error) throw error;
  if (!memberships?.length) {
    const { data: household, error: householdError } = await supabase.from("households").insert({ owner_id: user.id, name: "Little Fox Training" }).select().single();
    if (householdError) throw householdError;
    const { data: member, error: memberError } = await supabase.from("household_members").insert({
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
    }).select().single();
    if (memberError) throw memberError;
    context.household = household;
    context.member = member;
  } else {
    context.member = memberships[0];
    context.household = memberships[0].households;
  }
  await loadHouseholdData();
}

async function acceptMatchingInvites(email) {
  const { data: pending } = await supabase.from("household_members").select("id").ilike("invite_email", email).is("user_id", null).eq("status", "pending");
  if (!pending?.length) return;
  await Promise.all(pending.map(row => supabase.from("household_members").update({ user_id: session.user.id, status: "active" }).eq("id", row.id)));
}

async function loadHouseholdData() {
  const id = context.household.id;
  const [members, diapers, logs, expenses, suggestions] = await Promise.all([
    supabase.from("household_members").select("*").eq("household_id", id),
    can("can_view_inventory") ? supabase.from("diapers").select("*").eq("household_id", id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    (can("can_view_calendar") || can("can_view_trends")) ? supabase.from("logs").select("*, diapers(brand, style, size, item_type, purchase_price)").eq("household_id", id).order("happened_at", { ascending: false }) : Promise.resolve({ data: [] }),
    can("can_view_expenses") ? supabase.from("expenses").select("*").eq("household_id", id).order("expense_date", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("diaper_suggestions").select("*, diapers(brand, style, size)").eq("household_id", id).order("created_at", { ascending: false })
  ]);
  context.members = members.data || [];
  context.diapers = diapers.data || [];
  context.logs = logs.data || [];
  context.expenses = expenses.data || [];
  context.suggestions = suggestions.data || [];
}

function renderShell() {
  const allowed = navTabs.filter(([, , permission]) => can(permission));
  if (!allowed.some(([id]) => id === activeTab)) activeTab = allowed[0]?.[0] || "dashboard";
  setApp(`
    <div class="layout">
      <aside class="sidebar">
        <div class="brand"><h1>Little Fox Training</h1><p>${esc(context.household.name)}<br>${isOwner() ? "Owner" : "Restricted friend view"}</p></div>
        <nav class="tabs">${navTabs.map(([id, label, permission]) => `<button class="tab ${activeTab === id ? "active" : ""}" data-tab="${id}" ${can(permission) ? "" : "hidden"}>${label}</button>`).join("")}</nav>
        <button class="btn secondary" id="signOutBtn">Sign Out</button>
      </aside>
      <section class="main">
        <div class="topbar"><div><h2>${esc(navTabs.find(([id]) => id === activeTab)?.[1] || "Dashboard")}</h2><p>${isOwner() ? "Full access" : "Read-only friend access"}</p></div>${isOwner() ? `<button class="btn fox" data-tab="log">Add Log</button>` : canSuggest() ? `<button class="btn sky" data-tab="inventory">Suggest Diaper</button>` : ""}</div>
        <div id="view"></div>
      </section>
    </div>`);
  document.querySelectorAll("[data-tab]").forEach(btn => btn.addEventListener("click", () => { activeTab = btn.dataset.tab; renderShell(); }));
  document.getElementById("signOutBtn").addEventListener("click", async () => { await supabase.auth.signOut(); session = null; renderAuth(); });
  renderActiveView();
}

function renderActiveView() {
  const views = { dashboard: renderDashboard, log: renderLog, inventory: renderInventory, calendar: renderCalendar, trends: renderTrends, cloth: renderCloth, expenses: renderExpenses, settings: renderSettings };
  document.getElementById("view").innerHTML = views[activeTab]?.() || `<div class="empty">No access.</div>`;
  bindViewEvents();
}

function stats() {
  const wet = context.logs.filter(log => log.event === "wet").length;
  const messed = context.logs.filter(log => log.event === "messed").length;
  const dry = context.logs.filter(log => log.event === "dry").length;
  const leaks = context.logs.filter(log => log.leaked).length;
  const night = context.logs.filter(log => ["while_sleeping", "night_change", "night_accident"].includes(log.subcategory) || log.day_night === "night").length;
  const spent = [...context.expenses, ...context.diapers.map(d => ({ amount: d.purchase_price }))].reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return { wet, messed, dry, leaks, night, spent };
}

function stat(title, value, sub) { return `<article class="card"><h3>${esc(title)}</h3><h2>${esc(value)}</h2><p>${esc(sub)}</p></article>`; }

function renderDashboard() {
  const s = stats();
  return `<div class="grid three">${stat("Inventory", context.diapers.length, "visible items")}${stat("Wet / Messed", `${s.wet} / ${s.messed}`, `${s.leaks} leaks`)}${stat("Total Spent", money(s.spent), "inventory plus expenses")}</div>
    <section class="grid two" style="margin-top:14px"><article class="card"><h3>Recent Activity</h3><div class="list" style="margin-top:12px">${context.logs.slice(0, 5).map(renderLogItem).join("") || `<div class="empty">No visible logs yet.</div>`}</div></article><article class="card"><h3>Low Stock Watch</h3><div class="list" style="margin-top:12px">${context.diapers.filter(d => Number(d.stock_count || 0) <= 5).slice(0, 5).map(renderDiaper).join("") || `<div class="empty">Nothing low right now.</div>`}</div></article></section>${renderSuggestions()}`;
}

function renderLog() {
  if (!isOwner()) return renderCalendar();
  const wearables = context.diapers.filter(d => ["disposable", "cloth", "underpad"].includes(d.item_type));
  const inserts = context.diapers.filter(d => ["disposable_insert", "cloth_insert"].includes(d.item_type));
  const last = context.logs[0]?.changed_at || context.logs[0]?.happened_at || new Date();
  return `<article class="card"><h3>Log Change</h3><form id="logForm" class="grid" style="margin-top:12px"><div class="form-grid">
    <label>What happened<select name="event"><option value="wet">Wet</option><option value="messed">Messed</option><option value="dry">Dry</option></select></label>
    <label>When changed<input name="changed_at" type="datetime-local" value="${dateTimeLocal()}"></label>
    <label>Put on at<input name="put_on_at" type="datetime-local" value="${dateTimeLocal(last)}"></label>
    <label>Day / Night<select name="day_night"><option value="auto">Auto</option><option value="day">Day</option><option value="before_bed">Before bed</option><option value="night">Night</option><option value="morning">Morning change</option></select></label>
    <label>Diaper / Underpad<select name="diaper_id"><option value="">No diaper selected</option>${wearables.map(optionHtml).join("")}</select></label>
    <label>Insert / Booster<select name="insert_ids" multiple size="4">${inserts.map(optionHtml).join("")}</select></label>
    <label>Subcategory<select name="subcategory">${logSubcategories.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
    <label>Notes<textarea name="notes" placeholder="Optional notes"></textarea></label></div>
    <div class="pill-row"><label><span><input type="checkbox" name="leaked"> Leaked</span></label><label><span><input type="checkbox" name="accident"> Accident</span></label></div>
    <button class="btn fox" type="submit">Save Log</button></form></article>
    <article class="card" style="margin-top:14px"><h3>Recent Logs</h3><div class="list" style="margin-top:12px">${context.logs.slice(0, 8).map(renderLogItem).join("") || `<div class="empty">No logs yet.</div>`}</div></article>`;
}

function optionHtml(item) { return `<option value="${item.id}">${esc(item.brand)} ${esc(item.style)} (${esc(item.size || itemTypes[item.item_type])})</option>`; }
function renderCalendar() { return context.logs.length ? `<div class="list">${context.logs.map(renderLogItem).join("")}</div>` : `<div class="empty">No visible logs yet.</div>`; }

function renderLogItem(log) {
  const sub = log.subcategory ? labelFor(log.subcategory, logSubcategories) : log.day_night;
  return `<div class="item"><div class="item-head"><div><h4>${esc(titleCase(log.event))} on ${esc(dt(log.happened_at || log.changed_at))}</h4><p>${esc(log.diapers ? `${log.diapers.brand} ${log.diapers.style}` : "No diaper selected")}</p></div>${isOwner() ? `<button class="btn secondary" data-delete-log="${log.id}">Delete</button>` : ""}</div><div class="pill-row">${sub ? `<span class="pill">${esc(sub)}</span>` : ""}${log.leaked ? `<span class="pill alert">leaked</span>` : ""}${log.accident ? `<span class="pill alert">accident</span>` : ""}</div>${log.put_on_at || log.changed_at ? `<p>Worn ${esc(durationText(log.put_on_at, log.changed_at || log.happened_at))}</p>` : ""}${log.notes ? `<p>${esc(log.notes)}</p>` : ""}</div>`;
}

function durationText(start, end) {
  if (!start || !end) return "time not set";
  const hours = Math.max(0, (new Date(end) - new Date(start)) / 3600000);
  return `${hours.toFixed(1)} hr`;
}

function renderInventory() {
  return `${isOwner() ? renderInventoryForm("diaperForm", "Add Inventory Item") : ""}<section class="grid two" style="margin-top:14px"><article class="card"><h3>Inventory</h3><div class="list" style="margin-top:12px">${context.diapers.map(renderDiaper).join("") || `<div class="empty">No visible inventory.</div>`}</div></article>${canSuggest() ? renderSuggestCard() : ""}</section>`;
}

function renderInventoryForm(id, title) {
  return `<article class="card"><h3>${title}</h3><form id="${id}" class="grid" style="margin-top:12px"><div class="form-grid"><label>Brand<input name="brand" required></label><label>Style<input name="style" required></label><label>Size<input name="size"></label><label>Type<select name="item_type">${Object.entries(itemTypes).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><label>Total / stock count<input name="stock_count" type="number" min="0" value="1"></label><label>Clean count<input name="clean_count" type="number" min="0" value="1"></label><label>Purchase price<input name="purchase_price" type="number" min="0" step="0.01" value="0"></label></div><button class="btn fox" type="submit">Save Item</button></form></article>`;
}

function renderDiaper(item) {
  const dirty = clothDirtyCount(item.id);
  return `<div class="item"><div class="item-head"><div><h4>${esc(item.brand)} ${esc(item.style)}</h4><p>${esc(item.size || "No size")} - ${esc(itemTypes[item.item_type] || item.item_type)}</p></div><strong>${Number(item.stock_count || 0)}</strong></div><div class="pill-row"><span class="pill">${money(item.purchase_price)}</span>${item.item_type?.startsWith("cloth") || item.item_type === "underpad" ? `<span class="pill owner">${Math.max(0, Number(item.stock_count || 0) - dirty)} clean</span><span class="pill alert">${dirty} dirty</span>` : ""}${isOwner() ? `<button class="btn secondary" data-delete-diaper="${item.id}">Delete</button>` : ""}</div></div>`;
}

function renderCloth() {
  const clothItems = context.diapers.filter(d => ["cloth", "cloth_insert", "underpad"].includes(d.item_type));
  return `${isOwner() ? renderInventoryForm("clothForm", "Add Cloth Item") : ""}<section class="grid two" style="margin-top:14px"><article class="card"><h3>Cloth Diapers and Inserts</h3><div class="list" style="margin-top:12px">${clothItems.map(renderDiaper).join("") || `<div class="empty">No cloth items yet.</div>`}</div></article><article class="card"><h3>Cloth Performance</h3><div class="list" style="margin-top:12px">${clothItems.map(renderClothPerformance).join("") || `<div class="empty">No cloth performance yet.</div>`}</div></article></section>`;
}

function renderClothPerformance(item) {
  const uses = context.logs.filter(log => log.diaper_id === item.id);
  const leaks = uses.filter(log => log.leaked).length;
  const messed = uses.filter(log => log.event === "messed").length;
  const cpw = uses.length ? Number(item.purchase_price || 0) / uses.length : Number(item.purchase_price || 0);
  return `<div class="item"><div class="item-head"><div><h4>${esc(item.brand)} ${esc(item.style)}</h4><p>${uses.length} wears, ${leaks} leaks, ${messed} messes</p></div><strong>${money(cpw)}</strong></div><div class="pill-row"><span class="pill">cost per wear</span></div></div>`;
}

function clothDirtyCount(itemId) {
  const cutoff = Date.now() - 48 * 3600000;
  return context.logs.filter(log => log.diaper_id === itemId && new Date(log.changed_at || log.happened_at).getTime() >= cutoff).length;
}

function renderSuggestCard() {
  return `<article class="card"><h3>Suggest Diaper</h3><p>Friends can ping a suggestion without editing inventory or logs.</p><form id="suggestForm" class="grid" style="margin-top:12px"><label>Diaper<select name="diaper_id">${context.diapers.map(optionHtml).join("")}</select></label><label>Note<textarea name="note" placeholder="Optional note"></textarea></label><button class="btn sky" type="submit" ${context.diapers.length ? "" : "disabled"}>Send Suggestion</button></form></article>`;
}

function renderSuggestions() {
  if (!context.suggestions.length) return "";
  return `<article class="card" style="margin-top:14px"><h3>Diaper Suggestions</h3><div class="list" style="margin-top:12px">${context.suggestions.map(s => `<div class="item"><div class="item-head"><div><h4>${esc(s.diapers ? `${s.diapers.brand} ${s.diapers.style}` : "Deleted diaper")}</h4><p>${esc(s.note || "No note")}</p></div><span class="pill ${s.status === "new" ? "viewer" : "owner"}">${esc(s.status)}</span></div>${isOwner() && s.status === "new" ? `<div class="pill-row"><button class="btn secondary" data-suggestion-status="${s.id}" data-status="accepted">Accept</button><button class="btn secondary" data-suggestion-status="${s.id}" data-status="dismissed">Dismiss</button></div>` : ""}</div>`).join("")}</div></article>`;
}

function renderTrends() {
  const s = stats();
  const diaperCounts = countBy(context.logs.filter(log => log.diapers), log => `${log.diapers.brand} ${log.diapers.style}`);
  const materialCost = {
    Disposable: context.diapers.filter(d => d.item_type === "disposable" || d.item_type === "disposable_insert").reduce((sum, d) => sum + Number(d.purchase_price || 0), 0),
    Cloth: context.diapers.filter(d => d.item_type === "cloth" || d.item_type === "cloth_insert" || d.item_type === "underpad").reduce((sum, d) => sum + Number(d.purchase_price || 0), 0),
    Supplies: context.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  };
  return `<div class="grid three">${stat("Wet", s.wet, "events")}${stat("Messed", s.messed, "events")}${stat("Dry", s.dry, "events")}</div><section class="grid two" style="margin-top:14px">${barCard("Sleep and Day Summary", { Night: s.night, Day: Math.max(0, context.logs.length - s.night), Leaks: s.leaks, Accidents: context.logs.filter(l => l.accident).length })}${barCard("Diaper Usage", diaperCounts)}${barCard("Expense Split", materialCost)}${barCard("Subcategories", countBy(context.logs, log => labelFor(log.subcategory, logSubcategories) || "Other"))}</section>`;
}

function barCard(title, data) {
  const max = Math.max(1, ...Object.values(data).map(Number));
  return `<article class="card"><h3>${esc(title)}</h3><div class="bars">${Object.entries(data).map(([label, value]) => `<div class="bar-row"><span>${esc(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, Number(value) / max * 100)}%"></div></div><strong>${typeof value === "number" && value % 1 ? money(value) : esc(value)}</strong></div>`).join("") || `<div class="empty">No data yet.</div>`}</div></article>`;
}

function renderExpenses() {
  const inventoryExpense = context.diapers.map(d => ({ category: itemTypes[d.item_type] || "Inventory", brand: d.brand, item: d.style, amount: d.purchase_price, expense_date: d.created_at }));
  const rows = [...context.expenses, ...inventoryExpense];
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return `${isOwner() ? `<article class="card"><h3>Add Expense</h3><form id="expenseForm" class="grid" style="margin-top:12px"><div class="form-grid"><label>Category<input name="category" value="Supplies" required></label><label>Brand<input name="brand"></label><label>Item<input name="item" required></label><label>Amount<input name="amount" type="number" min="0" step="0.01" required></label><label>Date<input name="expense_date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div><button class="btn fox" type="submit">Save Expense</button></form></article>` : ""}<section class="grid two" style="margin-top:14px">${stat("Total Expenses", money(total), `${rows.length} visible rows`)}${barCard("By Category", sumBy(rows, row => row.category || "Other", row => row.amount))}</section><div class="list" style="margin-top:14px">${rows.map(row => `<div class="item"><div class="item-head"><div><h4>${esc(row.item)}</h4><p>${esc(row.category)} - ${esc(row.brand || "Other")}</p></div><strong>${money(row.amount)}</strong></div></div>`).join("") || `<div class="empty">No visible expenses.</div>`}</div>`;
}

function renderSettings() {
  if (!isOwner()) return `<div class="empty">Settings are hidden for restricted viewers.</div>`;
  return `<div class="grid two"><article class="card"><h3>Invite Friend</h3><p>Invite a friend and choose exactly what they can see.</p><form id="inviteForm" class="grid" style="margin-top:12px"><label>Email<input name="email" type="email" required></label><div class="form-grid">${permissionCheckbox("can_view_dashboard", "Dashboard", true)}${permissionCheckbox("can_view_calendar", "Daily log / Calendar", true)}${permissionCheckbox("can_view_inventory", "Inventory / Cloth", true)}${permissionCheckbox("can_view_trends", "Trends", true)}${permissionCheckbox("can_view_expenses", "Expenses", false)}${permissionCheckbox("can_view_settings", "Settings", false)}${permissionCheckbox("can_suggest_diaper", "Can suggest diaper", true)}</div><button class="btn fox" type="submit">Create Invite</button></form></article><article class="card"><h3>Members</h3><div class="list" style="margin-top:12px">${context.members.map(member => `<div class="item"><div class="item-head"><div><h4>${esc(member.invite_email || member.user_id)}</h4><p>${esc(member.status)} - ${esc(member.role)}</p></div><span class="pill ${member.role === "owner" ? "owner" : "viewer"}">${esc(member.role)}</span></div>${member.role !== "owner" ? `<button class="btn danger" data-revoke-member="${member.id}">Revoke</button>` : ""}</div>`).join("")}</div></article></div>`;
}

function permissionCheckbox(name, label, checked) { return `<label><span><input type="checkbox" name="${name}" ${checked ? "checked" : ""}> ${label}</span></label>`; }

function bindViewEvents() {
  document.getElementById("logForm")?.addEventListener("submit", saveLog);
  document.getElementById("diaperForm")?.addEventListener("submit", saveDiaper);
  document.getElementById("clothForm")?.addEventListener("submit", saveDiaper);
  document.getElementById("suggestForm")?.addEventListener("submit", saveSuggestion);
  document.getElementById("expenseForm")?.addEventListener("submit", saveExpense);
  document.getElementById("inviteForm")?.addEventListener("submit", saveInvite);
  document.querySelectorAll("[data-delete-diaper]").forEach(btn => btn.addEventListener("click", () => deleteDiaper(btn.dataset.deleteDiaper)));
  document.querySelectorAll("[data-delete-log]").forEach(btn => btn.addEventListener("click", () => deleteLog(btn.dataset.deleteLog)));
  document.querySelectorAll("[data-suggestion-status]").forEach(btn => btn.addEventListener("click", () => updateSuggestion(btn.dataset.suggestionStatus, btn.dataset.status)));
  document.querySelectorAll("[data-revoke-member]").forEach(btn => btn.addEventListener("click", () => revokeMember(btn.dataset.revokeMember)));
}

async function saveLog(event) {
  event.preventDefault();
  if (!isOwner()) return;
  const data = new FormData(event.currentTarget);
  const changedAt = data.get("changed_at") || dateTimeLocal();
  const { error } = await supabase.from("logs").insert({
    household_id: context.household.id,
    diaper_id: data.get("diaper_id") || null,
    insert_ids: data.getAll("insert_ids").filter(Boolean),
    event: data.get("event"),
    happened_at: new Date(changedAt).toISOString(),
    changed_at: new Date(changedAt).toISOString(),
    put_on_at: data.get("put_on_at") ? new Date(data.get("put_on_at")).toISOString() : null,
    day_night: data.get("day_night"),
    subcategory: data.get("subcategory"),
    leaked: data.has("leaked"),
    accident: data.has("accident"),
    notes: data.get("notes").trim(),
    created_by: session.user.id
  });
  if (error) return toast(error.message);
  await loadHouseholdData();
  activeTab = "log";
  renderShell();
  toast("Log saved.");
}

async function saveDiaper(event) {
  event.preventDefault();
  if (!isOwner()) return;
  const data = new FormData(event.currentTarget);
  const { error } = await supabase.from("diapers").insert({ household_id: context.household.id, brand: data.get("brand").trim(), style: data.get("style").trim(), size: data.get("size").trim(), item_type: data.get("item_type"), stock_count: Number(data.get("stock_count") || 0), clean_count: Number(data.get("clean_count") || data.get("stock_count") || 0), purchase_price: Number(data.get("purchase_price") || 0) });
  if (error) return toast(error.message);
  await loadHouseholdData();
  renderShell();
  toast("Inventory item saved.");
}

async function saveExpense(event) {
  event.preventDefault();
  if (!isOwner()) return;
  const data = new FormData(event.currentTarget);
  const { error } = await supabase.from("expenses").insert({ household_id: context.household.id, category: data.get("category").trim(), brand: data.get("brand").trim(), item: data.get("item").trim(), amount: Number(data.get("amount") || 0), expense_date: data.get("expense_date"), created_by: session.user.id });
  if (error) return toast(error.message);
  await loadHouseholdData();
  renderShell();
  toast("Expense saved.");
}

async function deleteDiaper(id) { if (!isOwner()) return; const { error } = await supabase.from("diapers").delete().eq("id", id); if (error) return toast(error.message); await loadHouseholdData(); renderShell(); }
async function deleteLog(id) { if (!isOwner()) return; const { error } = await supabase.from("logs").delete().eq("id", id); if (error) return toast(error.message); await loadHouseholdData(); renderShell(); }
async function saveSuggestion(event) { event.preventDefault(); const data = new FormData(event.currentTarget); const { error } = await supabase.from("diaper_suggestions").insert({ household_id: context.household.id, diaper_id: data.get("diaper_id"), suggested_by: session.user.id, note: data.get("note").trim() }); if (error) return toast(error.message); await loadHouseholdData(); renderShell(); toast("Suggestion sent."); }
async function updateSuggestion(id, status) { if (!isOwner()) return; const { error } = await supabase.from("diaper_suggestions").update({ status }).eq("id", id); if (error) return toast(error.message); await loadHouseholdData(); renderShell(); }
async function saveInvite(event) { event.preventDefault(); const data = new FormData(event.currentTarget); const row = { household_id: context.household.id, invite_email: data.get("email").trim().toLowerCase(), role: "viewer", status: "pending", can_view_dashboard: data.has("can_view_dashboard"), can_view_calendar: data.has("can_view_calendar"), can_view_inventory: data.has("can_view_inventory"), can_view_trends: data.has("can_view_trends"), can_view_expenses: data.has("can_view_expenses"), can_view_settings: data.has("can_view_settings"), can_suggest_diaper: data.has("can_suggest_diaper"), can_add_logs: false }; const { error } = await supabase.from("household_members").insert(row); if (error) return toast(error.message); await loadHouseholdData(); renderShell(); toast("Invite created. Ask them to sign up with that email."); }
async function revokeMember(id) { const { error } = await supabase.from("household_members").update({ status: "revoked" }).eq("id", id); if (error) return toast(error.message); await loadHouseholdData(); renderShell(); }

function titleCase(value) { return String(value || "").replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase()); }
function labelFor(value, pairs) { return pairs.find(([id]) => id === value)?.[1] || titleCase(value); }
function countBy(rows, keyFn) { return rows.reduce((acc, row) => { const key = keyFn(row) || "Other"; acc[key] = (acc[key] || 0) + 1; return acc; }, {}); }
function sumBy(rows, keyFn, valueFn) { return rows.reduce((acc, row) => { const key = keyFn(row) || "Other"; acc[key] = (acc[key] || 0) + Number(valueFn(row) || 0); return acc; }, {}); }

supabase.auth.onAuthStateChange((_event, nextSession) => { session = nextSession; });
init().catch(error => { console.error(error); setApp(`<section class="auth-card"><h1>Setup needed</h1><p>${esc(error.message)}</p><p>Make sure the latest Supabase SQL schema has been run.</p></section>`); });
