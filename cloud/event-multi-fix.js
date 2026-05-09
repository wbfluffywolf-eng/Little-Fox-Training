import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3200);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function selectedEvents(data) {
  const events = [];
  if (data.has("event_wet")) events.push("wet");
  if (data.has("event_messed")) events.push("messed");
  if (data.has("event_dry") || !events.length) return ["dry"];
  return events;
}

async function householdForCurrentUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) throw new Error("Please sign in again.");
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role, can_add_logs, households(owner_id)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw error;
  const memberships = data || [];
  const writable = memberships.find(row => row.role === "owner" || row.households?.owner_id === user.id) ||
    memberships.find(row => row.can_add_logs);
  if (!writable) throw new Error("This account does not have permission to add logs.");
  return { householdId: writable.household_id, userId: user.id };
}

function enhanceLogForm(form) {
  const select = form.querySelector('select[name="event"]');
  if (!select || form.dataset.multiEventReady === "true") return;
  select.closest("label").innerHTML = `What happened<div class="pill-row"><label><span><input type="checkbox" name="event_wet" ${select.value !== "dry" ? "checked" : ""}> Wet</span></label><label><span><input type="checkbox" name="event_messed" ${select.value === "messed" ? "checked" : ""}> Messed</span></label><label><span><input type="checkbox" name="event_dry" ${select.value === "dry" ? "checked" : ""}> Dry</span></label></div>`;
  form.dataset.multiEventReady = "true";
}

document.addEventListener("submit", async event => {
  if (event.target?.id !== "logForm") return;
  const form = event.target;
  if (form.dataset.logFixHandlesMultiEvent === "true") return;
  const data = new FormData(form);
  if (!data.has("event_wet") && !data.has("event_messed") && !data.has("event_dry")) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const button = form.querySelector("button[type='submit']");
  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }

  try {
    const { householdId, userId } = await householdForCurrentUser();
    const changedAt = data.get("changed_at") || new Date().toISOString();
    const base = {
      household_id: householdId,
      diaper_id: data.get("diaper_id") || null,
      insert_ids: data.getAll("insert_ids").filter(Boolean),
      happened_at: toIso(changedAt),
      changed_at: toIso(changedAt),
      put_on_at: toIso(data.get("put_on_at")),
      day_night: data.get("day_night"),
      subcategory: data.get("subcategory"),
      leaked: data.has("leaked"),
      accident: data.has("accident"),
      notes: data.get("notes").trim(),
      created_by: userId
    };
    const events = selectedEvents(data);
    const rows = events.map(name => ({
      ...base,
      event: name,
      notes: events.length > 1 ? `${base.notes}${base.notes ? " " : ""}(same change: wet and messed)` : base.notes
    }));
    const { error } = await supabase.from("logs").insert(rows);
    if (error) throw error;
    toast(events.length > 1 ? "Wet and messed log saved." : "Log saved.");
    setTimeout(() => location.reload(), 700);
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = "Save Log";
    }
    toast(`Log could not save: ${error.message}`);
  }
}, true);

function enhanceForms() {
  document.querySelectorAll("#logForm").forEach(enhanceLogForm);
}

new MutationObserver(enhanceForms).observe(document.body, { childList: true, subtree: true });
enhanceForms();
