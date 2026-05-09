import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let cursor = new Date();

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, ch => ch.toUpperCase());
}

async function loadLogs() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;
  const { data: memberships, error: memberError } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", session.user.id)
    .eq("status", "active");
  if (memberError) throw memberError;
  const member = memberships?.find(row => row.role === "owner" || row.households?.owner_id === session.user.id) || memberships?.[0];
  const household = member?.households;
  if (!member || !household) return null;
  const canView = member.role === "owner" || household.owner_id === session.user.id || member.can_view_calendar === true;
  if (!canView) return { logs: [] };
  const { data, error } = await supabase
    .from("logs")
    .select("*, diapers(brand, style, size)")
    .eq("household_id", household.id)
    .order("happened_at", { ascending: false });
  if (error) throw error;
  return { logs: data || [] };
}

function logItem(log) {
  const diaper = log.diapers ? `${log.diapers.brand} ${log.diapers.style}${log.diapers.size ? ` (${log.diapers.size})` : ""}` : "No diaper selected";
  return `
    <div class="item">
      <div class="item-head"><div><h4>${esc(label(log.event))} on ${esc(new Date(log.happened_at || log.changed_at).toLocaleString())}</h4><p>${esc(diaper)}</p></div></div>
      <div class="pill-row">
        ${log.subcategory ? `<span class="pill">${esc(label(log.subcategory))}</span>` : ""}
        ${log.day_night ? `<span class="pill">${esc(label(log.day_night))}</span>` : ""}
        ${log.leaked ? `<span class="pill alert">Leaked</span>` : ""}
        ${log.accident ? `<span class="pill alert">Accident</span>` : ""}
      </div>
      ${log.notes ? `<p>${esc(log.notes)}</p>` : ""}
    </div>`;
}

function renderCalendar(logs) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthStart = new Date(year, month, 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const byDay = logs.reduce((acc, log) => {
    const key = localDateKey(log.happened_at || log.changed_at);
    acc[key] ||= [];
    acc[key].push(log);
    return acc;
  }, {});
  const today = localDateKey(new Date());
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = localDateKey(date);
    const dayLogs = byDay[key] || [];
    const counts = {
      wet: dayLogs.filter(log => log.event === "wet").length,
      messed: dayLogs.filter(log => log.event === "messed").length,
      dry: dayLogs.filter(log => log.event === "dry").length,
      leaked: dayLogs.filter(log => log.leaked).length,
      accident: dayLogs.filter(log => log.accident).length
    };
    return `<button class="calendar-day ${date.getMonth() === month ? "" : "muted-day"} ${key === today ? "today" : ""}" type="button" data-calendar-day="${key}"><span>${date.getDate()}</span><strong>${dayLogs.length || ""}</strong><div class="calendar-dots">${counts.wet ? `<i class="wet" title="Wet"></i>` : ""}${counts.messed ? `<i class="messed" title="Messed"></i>` : ""}${counts.dry ? `<i class="dry" title="Dry"></i>` : ""}${counts.leaked ? `<i class="leaked" title="Leaked"></i>` : ""}${counts.accident ? `<i class="accident" title="Accident"></i>` : ""}</div></button>`;
  }).join("");
  const monthLogs = logs.filter(log => {
    const when = new Date(log.happened_at || log.changed_at);
    return when.getFullYear() === year && when.getMonth() === month;
  });
  return `
    <section class="card calendar-card">
      <div class="item-head"><div><h3>${esc(cursor.toLocaleString(undefined, { month: "long", year: "numeric" }))}</h3><p>${monthLogs.length} tracked ${monthLogs.length === 1 ? "event" : "events"} this month.</p></div><div class="pill-row"><button class="btn secondary" type="button" data-calendar-month="-1">Previous</button><button class="btn secondary" type="button" data-calendar-month="0">Today</button><button class="btn secondary" type="button" data-calendar-month="1">Next</button></div></div>
      <div class="calendar-weekdays">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `<span>${day}</span>`).join("")}</div>
      <div class="calendar-grid">${cells}</div>
      <div class="pill-row calendar-legend"><span class="pill"><i class="wet"></i> Wet</span><span class="pill"><i class="messed"></i> Messed</span><span class="pill"><i class="dry"></i> Dry</span><span class="pill"><i class="leaked"></i> Leaked</span><span class="pill"><i class="accident"></i> Accident</span></div>
    </section>
    <section class="card calendar-detail" style="margin-top:14px"><h3>Month Activity</h3><div class="list" style="margin-top:12px">${monthLogs.slice(0, 14).map(logItem).join("") || `<div class="empty">No logs for this month.</div>`}</div></section>`;
}

async function hydrateCalendar(force = false) {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (title !== "Calendar" || !view) return;
  if (view.dataset.calendarTracking === "true" && !force) return;
  const ctx = await loadLogs();
  if (!ctx) return;
  view.dataset.calendarTracking = "true";
  view.innerHTML = renderCalendar(ctx.logs);
  view.querySelectorAll("[data-calendar-month]").forEach(button => button.addEventListener("click", () => {
    const offset = Number(button.dataset.calendarMonth || 0);
    cursor = offset === 0 ? new Date() : new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    view.dataset.calendarTracking = "";
    hydrateCalendar(true);
  }));
  view.querySelectorAll("[data-calendar-day]").forEach(button => button.addEventListener("click", () => {
    const logs = ctx.logs.filter(log => localDateKey(log.happened_at || log.changed_at) === button.dataset.calendarDay);
    const list = view.querySelector(".calendar-detail .list");
    if (list) list.innerHTML = logs.map(logItem).join("") || `<div class="empty">No logs for ${esc(button.dataset.calendarDay)}.</div>`;
  }));
}

new MutationObserver(() => hydrateCalendar().catch(() => {})).observe(document.getElementById("app"), { childList: true, subtree: true });
setTimeout(() => hydrateCalendar().catch(() => {}), 0);
