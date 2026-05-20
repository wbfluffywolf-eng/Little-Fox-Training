import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let calendarCursor = new Date();

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

function label(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, ch => ch.toUpperCase());
}

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function ownerHousehold() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;
  const { data, error } = await supabase
    .from("household_members")
    .select("role, can_view_calendar, can_view_trends, households(id, owner_id, name)")
    .eq("user_id", session.user.id)
    .eq("status", "active");
  if (error) throw error;
  const member = data?.find(row => row.role === "owner" || row.households?.owner_id === session.user.id) || data?.[0];
  return member?.households ? { session, member, household: member.households } : null;
}

async function loadLogs() {
  const ctx = await ownerHousehold();
  if (!ctx) return { logs: [], diapers: [], expenses: [], household: null };
  const [logsResult, diapersResult, expensesResult] = await Promise.all([
    supabase
      .from("logs")
      .select("*, taken_off_diaper:diapers!logs_diaper_id_fkey(brand, style, size, item_type, purchase_price), put_on_diaper:diapers!logs_put_on_diaper_id_fkey(brand, style, size, item_type, purchase_price)")
      .eq("household_id", ctx.household.id)
      .order("happened_at", { ascending: false })
      .limit(500),
    supabase
      .from("diapers")
      .select("id, brand, style, size, item_type, purchase_price, stock_count")
      .eq("household_id", ctx.household.id)
      .limit(1000),
    supabase
      .from("expenses")
      .select("amount, category")
      .eq("household_id", ctx.household.id)
      .limit(500)
  ]);
  if (logsResult.error) throw logsResult.error;
  return {
    household: ctx.household,
    diapers: diapersResult.error ? [] : diapersResult.data || [],
    expenses: expensesResult.error ? [] : expensesResult.data || [],
    logs: (logsResult.data || []).map(log => ({
      ...log,
      diapers: log.taken_off_diaper || log.put_on_diaper || null
    }))
  };
}

function logItem(log) {
  const takenOff = log.taken_off_diaper ? `${log.taken_off_diaper.brand} ${log.taken_off_diaper.style}${log.taken_off_diaper.size ? ` (${log.taken_off_diaper.size})` : ""}` : "";
  const putOn = log.put_on_diaper ? `${log.put_on_diaper.brand} ${log.put_on_diaper.style}${log.put_on_diaper.size ? ` (${log.put_on_diaper.size})` : ""}` : "";
  const diaper = log.diapers ? `${log.diapers.brand} ${log.diapers.style}${log.diapers.size ? ` (${log.diapers.size})` : ""}` : "No diaper selected";
  return `
    <div class="item">
      <div class="item-head">
        <div>
          <h4>${esc(label(log.event))} on ${esc(new Date(log.happened_at || log.changed_at || log.created_at).toLocaleString())}</h4>
          ${putOn ? `<p>Put on ${esc(putOn)}</p>` : ""}
          ${takenOff ? `<p>Took off ${esc(takenOff)}</p>` : (!putOn ? `<p>${esc(diaper)}</p>` : "")}
        </div>
      </div>
      <div class="pill-row">
        ${log.day_night ? `<span class="pill">${esc(label(log.day_night))}</span>` : ""}
        ${log.subcategory && log.subcategory !== log.day_night ? `<span class="pill">${esc(label(log.subcategory))}</span>` : ""}
        ${log.leaked ? `<span class="pill alert">Leaked</span>` : ""}
        ${log.accident ? `<span class="pill alert">Accident</span>` : ""}
      </div>
      ${log.notes ? `<p>${esc(log.notes)}</p>` : ""}
    </div>
  `;
}

function stats(logs) {
  return {
    wet: logs.filter(log => log.event === "wet").length,
    messed: logs.filter(log => log.event === "messed").length,
    dry: logs.filter(log => log.event === "dry").length,
    leaks: logs.filter(log => log.leaked).length
  };
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function sum(values, pick) {
  return values.reduce((total, item) => total + Number(pick(item) || 0), 0);
}

function progressRow(row, max) {
  const value = Number(row.value || 0);
  const percent = max ? Math.max(2, Math.round(value / max * 100)) : 2;
  return `
    <div class="bar-row">
      <span>${esc(row.label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
      <b>${esc(row.display ?? value)}</b>
    </div>
  `;
}

function trendGroup(title, rows) {
  const max = Math.max(0, ...rows.map(row => row.value));
  return `
    <article class="card">
      <h3>${esc(title)}</h3>
      <div class="bars">
        ${rows.some(row => row.value) ? rows.map(row => progressRow(row, max)).join("") : `<div class="empty">No data yet.</div>`}
      </div>
    </article>
  `;
}

function expenseType(item) {
  const type = String(item.item_type || item.category || "").toLowerCase();
  if (type.includes("cloth") || type.includes("insert") || type.includes("booster")) return "Cloth";
  if (type.includes("supply") || type.includes("cream") || type.includes("wipe")) return "Supplies";
  return "Disposable";
}

function renderTrends(logs, diapers, expenses) {
  const s = stats(logs);
  const nightCount = logs.filter(log => {
    const when = String(log.day_night || log.subcategory || "").toLowerCase();
    return ["night", "before_bed", "before bed", "overnight", "while_sleeping", "night_change", "night_accident"].includes(when);
  }).length;
  const accidentCount = logs.filter(log => log.accident).length;
  const diaperSpend = sum(diapers, item => item.purchase_price);
  const expenseSpend = sum(expenses, item => item.amount);
  const spendRows = ["Disposable", "Cloth", "Supplies"].map(name => {
    const value = sum(diapers.filter(item => expenseType(item) === name), item => item.purchase_price)
      + sum(expenses.filter(item => expenseType(item) === name), item => item.amount);
    return { label: name, value, display: money(value) };
  });
  const eventRows = [
    { label: "Wet", value: s.wet },
    { label: "Messed", value: s.messed },
    { label: "Dry", value: s.dry },
    { label: "Leaks", value: s.leaks },
    { label: "Accidents", value: accidentCount }
  ];
  const whenRows = [
    { label: "Night", value: nightCount },
    { label: "Day", value: Math.max(0, logs.length - nightCount) },
    { label: "Leaks", value: s.leaks },
    { label: "Accidents", value: accidentCount }
  ];
  return `
    <section class="grid three">
      <article class="card"><h3>Wet</h3><h2>${s.wet}</h2><p>events</p></article>
      <article class="card"><h3>Messed</h3><h2>${s.messed}</h2><p>events</p></article>
      <article class="card"><h3>Dry</h3><h2>${s.dry}</h2><p>events</p></article>
    </section>
    <section class="grid two" style="margin-top:14px">
      ${trendGroup("Sleep and Day Summary", whenRows)}
      ${trendGroup("Expense Split", spendRows)}
    </section>
    <section class="grid two" style="margin-top:14px">
      ${trendGroup("Event Type", eventRows)}
      <article class="card">
        <h3>Total Spent</h3>
        <h2>${money(diaperSpend + expenseSpend)}</h2>
        <p>inventory plus expenses</p>
      </article>
    </section>
  `;
}

function renderDashboardLogs(logs) {
  const s = stats(logs);
  const statCard = [...document.querySelectorAll(".card h3")].find(h => h.textContent.trim() === "Wet / Messed")?.closest(".card");
  if (statCard) {
    const value = statCard.querySelector("h2");
    const sub = statCard.querySelector("p");
    if (value) value.textContent = `${s.wet} / ${s.messed}`;
    if (sub) sub.textContent = `${s.leaks} leaks`;
  }
  const logListTitles = ["Recent Activity", "Recent Logs", "Month Activity"];
  const recent = [...document.querySelectorAll(".card h3")].find(h => logListTitles.includes(h.textContent.trim()))?.closest(".card")?.querySelector(".list");
  if (recent) recent.innerHTML = logs.slice(0, 8).map(logItem).join("") || `<div class="empty">No visible logs yet.</div>`;
}

function renderCalendar(logs) {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const monthStart = new Date(year, month, 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const byDay = logs.reduce((acc, log) => {
    const key = localDateKey(log.happened_at || log.changed_at || log.created_at);
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
    const counts = stats(dayLogs);
    const accidents = dayLogs.filter(log => log.accident).length;
    return `
      <button class="calendar-day ${date.getMonth() === month ? "" : "muted-day"} ${key === today ? "today" : ""}" type="button" data-calendar-day="${key}">
        <span>${date.getDate()}</span>
        <strong>${dayLogs.length || ""}</strong>
        <div class="calendar-dots">
          ${counts.wet ? `<i class="wet" title="Wet"></i>` : ""}
          ${counts.messed ? `<i class="messed" title="Messed"></i>` : ""}
          ${counts.dry ? `<i class="dry" title="Dry"></i>` : ""}
          ${counts.leaks ? `<i class="leaked" title="Leaked"></i>` : ""}
          ${accidents ? `<i class="accident" title="Accident"></i>` : ""}
        </div>
      </button>
    `;
  }).join("");
  const monthLogs = logs.filter(log => {
    const when = new Date(log.happened_at || log.changed_at || log.created_at);
    return when.getFullYear() === year && when.getMonth() === month;
  });
  return `
    <section class="card calendar-card">
      <div class="item-head">
        <div>
          <h3>${esc(calendarCursor.toLocaleString(undefined, { month: "long", year: "numeric" }))}</h3>
          <p>${monthLogs.length} tracked ${monthLogs.length === 1 ? "event" : "events"} this month.</p>
        </div>
        <div class="pill-row">
          <button class="btn secondary" type="button" data-v80-calendar-month="-1">Previous</button>
          <button class="btn secondary" type="button" data-v80-calendar-month="0">Today</button>
          <button class="btn secondary" type="button" data-v80-calendar-month="1">Next</button>
        </div>
      </div>
      <div class="calendar-weekdays">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => `<span>${day}</span>`).join("")}</div>
      <div class="calendar-grid">${cells}</div>
      <div class="pill-row calendar-legend">
        <span class="pill"><i class="wet"></i> Wet</span>
        <span class="pill"><i class="messed"></i> Messed</span>
        <span class="pill"><i class="dry"></i> Dry</span>
        <span class="pill"><i class="leaked"></i> Leaked</span>
        <span class="pill"><i class="accident"></i> Accident</span>
      </div>
    </section>
    <section class="card calendar-detail" style="margin-top:14px">
      <h3>Month Activity</h3>
      <div class="list" style="margin-top:12px">${monthLogs.slice(0, 20).map(logItem).join("") || `<div class="empty">No logs for this month.</div>`}</div>
    </section>
  `;
}

async function repairLogsView(force = false) {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (!view || !["Dashboard", "Calendar", "Daily Log", "Trends"].includes(title || "")) return;
  if (view.dataset.logsRelationshipFix === "true" && !force) return;
  const { logs, diapers, expenses } = await loadLogs();
  view.dataset.logsRelationshipFix = "true";
  if (title === "Calendar") {
    view.innerHTML = renderCalendar(logs);
  } else if (title === "Trends") {
    view.innerHTML = renderTrends(logs, diapers, expenses);
  } else {
    renderDashboardLogs(logs);
  }
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-tab]")) setTimeout(() => repairLogsView(true).catch(() => {}), 250);
  const monthButton = event.target.closest("[data-v80-calendar-month]");
  if (monthButton) {
    const offset = Number(monthButton.dataset.v80CalendarMonth || 0);
    calendarCursor = offset === 0 ? new Date() : new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + offset, 1);
    repairLogsView(true).catch(() => {});
  }
  const dayButton = event.target.closest("[data-calendar-day]");
  if (dayButton) {
    loadLogs().then(({ logs }) => {
      const list = document.querySelector(".calendar-detail .list");
      const dayLogs = logs.filter(log => localDateKey(log.happened_at || log.changed_at || log.created_at) === dayButton.dataset.calendarDay);
      if (list) list.innerHTML = dayLogs.map(logItem).join("") || `<div class="empty">No logs for ${esc(dayButton.dataset.calendarDay)}.</div>`;
    }).catch(() => {});
  }
});

[600, 1600, 3200].forEach(delay => setTimeout(() => repairLogsView(true).catch(() => {}), delay));
