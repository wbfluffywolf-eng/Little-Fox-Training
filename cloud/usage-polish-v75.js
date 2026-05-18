import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const APP_VERSION = "v82";
const LATEST_LINK = "https://wbfluffywolf-eng.github.io/Little-Fox-Training/cloud/?v=82";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function currentTabTitle() {
  return document.querySelector(".topbar h2")?.textContent.trim() || "";
}

function eventParts(text) {
  const match = String(text || "").match(/^(Wet|Messed) on (.+)$/i);
  if (!match) return null;
  return { event: match[1].toLowerCase(), when: match[2] };
}

function itemDiaperText(item) {
  return item.querySelector(".item-head p")?.textContent.trim() || "";
}

function isSameWetMessChange(a, b) {
  const aTitle = eventParts(a.querySelector("h4")?.textContent);
  const bTitle = eventParts(b.querySelector("h4")?.textContent);
  if (!aTitle || !bTitle || aTitle.when !== bTitle.when || aTitle.event === bTitle.event) return false;
  if (itemDiaperText(a) !== itemDiaperText(b)) return false;
  const combinedText = `${a.textContent} ${b.textContent}`;
  return /\(same change:\s*wet and messed\)/i.test(combinedText);
}

function mergeRecentPair(primary, duplicate) {
  const primaryTitle = eventParts(primary.querySelector("h4")?.textContent);
  const duplicateTitle = eventParts(duplicate.querySelector("h4")?.textContent);
  if (!primaryTitle) return;
  const title = primary.querySelector("h4");
  title.textContent = `Wet and Messed on ${primaryTitle.when}`;
  title.dataset.mergedWetMess = "true";

  const primaryButton = primary.querySelector("[data-delete-log]");
  const duplicateButton = duplicate.querySelector("[data-delete-log]");
  if (primaryButton && duplicateButton && !primary.querySelector("[data-delete-log][data-merged-extra]")) {
    primaryButton.textContent = `Delete ${primaryTitle.event}`;
    duplicateButton.textContent = `Delete ${duplicateTitle?.event || "other"}`;
    duplicateButton.dataset.mergedExtra = "true";
    primaryButton.after(duplicateButton);
  }
  duplicate.remove();
}

function collapseWetMessLists() {
  const headings = [...document.querySelectorAll(".card h3")]
    .filter(heading => ["Recent Activity", "Month Activity", "Recent Logs", "Recent Cloth Wears"].includes(heading.textContent.trim()));
  headings.forEach(heading => {
    const list = heading.closest(".card")?.querySelector(".list");
    if (!list) return;
    const items = [...list.querySelectorAll(":scope > .item")];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.querySelector("h4")?.dataset.mergedWetMess === "true") continue;
      const match = items.slice(i + 1).find(other => isSameWetMessChange(item, other));
      if (match) mergeRecentPair(item, match);
    }
  });
}

function patchLatestReleaseText() {
  document.querySelectorAll(".launch-link").forEach(link => {
    link.textContent = LATEST_LINK;
    link.setAttribute("href", LATEST_LINK);
  });
  document.querySelectorAll("#launchReadinessCard .muted").forEach(node => {
    if (/Current release:/i.test(node.textContent || "")) {
      node.textContent = `Current release: Little Fox Training Cloud ${APP_VERSION}`;
    }
  });
}

function injectCathStentControls() {
  document.querySelectorAll("form").forEach(form => {
    const checkbox = form.querySelector('[name="catheter_stent_note"]');
    const notes = form.querySelector('textarea[name="notes"]');
    if (!checkbox || !notes || form.querySelector('[name="catheter_stent_state"]')) return;
    const row = checkbox.closest(".pill-row") || checkbox.closest("label")?.parentElement;
    const label = document.createElement("label");
    label.dataset.cathStentState = "true";
    label.innerHTML = `Cath / stent state<select name="catheter_stent_state">
      <option value="">Choose if needed</option>
      <option value="catheter in">Catheter in</option>
      <option value="stent in">Stent in</option>
      <option value="catheter and stent in">Catheter and stent in</option>
      <option value="changed or cleaned">Changed or cleaned</option>
      <option value="leaking around it">Leaking around it</option>
      <option value="blocked or kinked">Blocked or kinked</option>
      <option value="irritated or sore">Irritated or sore</option>
      <option value="removed">Removed</option>
    </select>`;
    if (row?.classList?.contains("pill-row")) row.after(label);
    else notes.closest("label")?.before(label);
  });
}

document.addEventListener("submit", event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const checkbox = form.querySelector('[name="catheter_stent_note"]:checked');
  const state = form.querySelector('[name="catheter_stent_state"]')?.value;
  const notes = form.querySelector('textarea[name="notes"]');
  if (!checkbox || !state || !notes) return;
  const addition = `Cath / stent state: ${state}.`;
  if (notes.value.toLowerCase().includes(addition.toLowerCase())) return;
  notes.value = notes.value.trim() ? `${notes.value.trim()} ${addition}` : addition;
}, true);

async function activeHouseholdId() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return "";
  const { data } = await supabase
    .from("household_members")
    .select("household_id, role, status, households(owner_id)")
    .eq("user_id", user.id)
    .eq("status", "active");
  const personal = (data || []).find(row => row.role === "owner" || row.households?.owner_id === user.id);
  return personal?.household_id || data?.[0]?.household_id || "";
}

function rate(part, total) {
  return total ? `${Math.round(part / total * 100)}%` : "0%";
}

function logUsesDiaper(log, diaperId) {
  return log.diaper_id === diaperId || (Array.isArray(log.insert_ids) && log.insert_ids.includes(diaperId));
}

function performanceRow(item, logs) {
  const uses = logs.filter(log => logUsesDiaper(log, item.id));
  const wet = uses.filter(log => log.event === "wet").length;
  const messed = uses.filter(log => log.event === "messed").length;
  const leaks = uses.filter(log => log.leaked).length;
  const title = `${item.brand || ""} ${item.style || ""}`.trim() || "Diaper";
  return `
    <div class="item">
      <div class="item-head">
        <div>
          <h4>${esc(title)}</h4>
          <p>${uses.length} uses, ${wet} wet, ${messed} messy, ${leaks} leaks</p>
        </div>
        <strong>${esc(rate(leaks, uses.length))}</strong>
      </div>
      <div class="pill-row">
        <span class="pill">wet ${esc(rate(wet, uses.length))}</span>
        <span class="pill">messy ${esc(rate(messed, uses.length))}</span>
        <span class="pill ${leaks ? "alert" : "owner"}">leak ${esc(rate(leaks, uses.length))}</span>
      </div>
    </div>
  `;
}

async function injectDiaperPerformance() {
  if (currentTabTitle() !== "Trends" || document.getElementById("diaperPerformanceCard")) return;
  const view = document.getElementById("view");
  const householdId = await activeHouseholdId();
  if (!view || !householdId) return;
  const [diapersResult, logsResult] = await Promise.all([
    supabase.from("diapers").select("id, brand, style, size, item_type").eq("household_id", householdId).limit(500),
    supabase.from("logs").select("event, leaked, diaper_id, insert_ids").eq("household_id", householdId).limit(1000)
  ]);
  const diapers = (diapersResult.data || []).filter(item => ["disposable", "cloth", "underpad"].includes(item.item_type));
  const logs = logsResult.data || [];
  const rows = diapers
    .map(item => ({ item, uses: logs.filter(log => logUsesDiaper(log, item.id)).length }))
    .filter(row => row.uses > 0)
    .sort((a, b) => b.uses - a.uses)
    .slice(0, 15);
  view.insertAdjacentHTML("beforeend", `
    <article class="card" id="diaperPerformanceCard" style="margin-top:14px">
      <h3>Diaper Performance</h3>
      <p>Use this to compare which diapers stay drier, get messy, or leak most often before buying more.</p>
      <div class="list" style="margin-top:12px">
        ${rows.map(row => performanceRow(row.item, logs)).join("") || `<div class="empty">No diaper performance yet.</div>`}
      </div>
    </article>
  `);
}

function refreshUsagePolish() {
  patchLatestReleaseText();
  collapseWetMessLists();
  injectCathStentControls();
  injectDiaperPerformance().catch(() => {});
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-tab], [data-calendar-day], [data-calendar-month]")) {
    setTimeout(refreshUsagePolish, 120);
    setTimeout(refreshUsagePolish, 500);
  }
});

new MutationObserver(refreshUsagePolish).observe(document.body, { childList: true, subtree: true });

[0, 300, 900, 1800, 3200].forEach(delay => setTimeout(refreshUsagePolish, delay));
