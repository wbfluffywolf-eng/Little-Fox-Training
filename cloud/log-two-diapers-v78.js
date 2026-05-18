import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const logFormIds = new Set(["logForm", "clothWearForm"]);

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3000);
}

function selectedEvents(data) {
  const events = [];
  if (data.has("event_wet")) events.push("wet");
  if (data.has("event_messed")) events.push("messed");
  if (data.has("event_dry")) return ["dry"];
  return events.length ? events : [data.get("event") || "wet"];
}

async function activeContext() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;
  const { data: memberships, error } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", session.user.id)
    .eq("status", "active");
  if (error) throw error;
  const member = memberships?.find(row => row.role === "owner" || row.households?.owner_id === session.user.id) || memberships?.[0];
  if (!member?.households) return null;
  return { session, member, household: member.households };
}

function dateTimeLocal(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function latestWearing(householdId) {
  const { data } = await supabase
    .from("logs")
    .select("diaper_id, put_on_diaper_id, happened_at, changed_at, created_at")
    .eq("household_id", householdId)
    .order("happened_at", { ascending: false })
    .limit(1);
  const latest = data?.[0];
  return {
    diaperId: latest?.put_on_diaper_id || latest?.diaper_id || "",
    putOnAt: latest?.changed_at || latest?.happened_at || latest?.created_at || ""
  };
}

async function decrementInventory(diaperId, insertIds) {
  const ids = [diaperId, ...insertIds].filter(Boolean);
  if (!ids.length) return null;
  const { data: items, error: loadError } = await supabase
    .from("diapers")
    .select("id, item_type, stock_count, clean_count")
    .in("id", ids);
  if (loadError) return loadError;
  const updates = (items || []).map(item => {
    const clothLike = ["cloth", "cloth_insert", "underpad"].includes(item.item_type);
    const next = clothLike
      ? { clean_count: Math.max(0, Number(item.clean_count ?? item.stock_count ?? 0) - 1) }
      : { stock_count: Math.max(0, Number(item.stock_count || 0) - 1) };
    return supabase.from("diapers").update(next).eq("id", item.id);
  });
  const results = await Promise.all(updates);
  return results.find(result => result.error)?.error || null;
}

async function inventoryItems(householdId) {
  const { data } = await supabase
    .from("diapers")
    .select("id, item_type, stock_count, clean_count")
    .eq("household_id", householdId)
    .limit(1000);
  return data || [];
}

function inventoryCountLabel(item) {
  if (!item) return "";
  const count = ["cloth", "cloth_insert", "underpad"].includes(item.item_type)
    ? Number(item.clean_count ?? item.stock_count ?? 0)
    : Number(item.stock_count ?? 0);
  return Number.isFinite(count) ? ` - ${count} in inventory` : "";
}

function annotateInventoryCounts(select, items) {
  if (!select) return;
  [...select.options].forEach(option => {
    const item = items.find(row => row.id === option.value);
    if (!item || / - \d+ in inventory$/.test(option.textContent || "")) return;
    option.textContent = `${option.textContent}${inventoryCountLabel(item)}`;
  });
}

function explainForm(form) {
  const card = form.closest(".card");
  if (!card || card.querySelector("[data-two-diaper-help]")) return;
  const help = document.createElement("p");
  help.dataset.twoDiaperHelp = "true";
  help.className = "muted";
  help.textContent = "Wet, messy, dry, leaked, and accident describe the diaper taken off. New diaper put on starts after this change.";
  form.insertAdjacentElement("beforebegin", help);
}

function simplifyTiming(form) {
  const changedAt = form.querySelector('[name="changed_at"]');
  const putOnAt = form.querySelector('[name="put_on_at"]');
  const dayNight = form.querySelector('select[name="day_night"]');
  const subcategory = form.querySelector('select[name="subcategory"]');
  if (changedAt) changedAt.value = dateTimeLocal();
  const putOnLabel = putOnAt?.closest("label");
  if (putOnLabel?.childNodes[0]?.nodeType === Node.TEXT_NODE) {
    putOnLabel.childNodes[0].textContent = "Old diaper put on at";
  }
  const dayNightLabel = dayNight?.closest("label");
  if (dayNightLabel?.childNodes[0]?.nodeType === Node.TEXT_NODE) {
    dayNightLabel.childNodes[0].textContent = "When";
  }
  if (dayNight && !dayNight.querySelector('option[value="evening"]')) {
    const option = document.createElement("option");
    option.value = "evening";
    option.textContent = "Evening";
    dayNight.insertBefore(option, dayNight.querySelector('option[value="before_bed"]') || null);
  }
  if (subcategory) {
    subcategory.value = "";
    subcategory.closest("label")?.remove();
  }
}

async function patchForm(form) {
  if (!form || form.dataset.twoDiaperReady === "true") return;
  const putOnSelect = form.querySelector('select[name="diaper_id"]');
  if (!putOnSelect) return;

  putOnSelect.name = "put_on_diaper_id";
  const putOnLabel = putOnSelect.closest("label");
  if (putOnLabel?.childNodes[0]?.nodeType === Node.TEXT_NODE) {
    putOnLabel.childNodes[0].textContent = putOnLabel.textContent.toLowerCase().includes("cloth")
      ? "New cloth diaper put on"
      : "New diaper put on";
  }

  const takenOffLabel = putOnLabel.cloneNode(true);
  const takenOffSelect = takenOffLabel.querySelector("select");
  takenOffSelect.name = "diaper_id";
  if (takenOffLabel.childNodes[0]?.nodeType === Node.TEXT_NODE) {
    takenOffLabel.childNodes[0].textContent = "Diaper taken off";
  }
  putOnLabel.insertAdjacentElement("beforebegin", takenOffLabel);
  simplifyTiming(form);
  explainForm(form);
  form.dataset.twoDiaperReady = "true";

  const ctx = await activeContext().catch(() => null);
  const wearing = ctx ? await latestWearing(ctx.household.id).catch(() => null) : null;
  const items = ctx ? await inventoryItems(ctx.household.id).catch(() => []) : [];
  annotateInventoryCounts(takenOffSelect, items);
  annotateInventoryCounts(putOnSelect, items);
  annotateInventoryCounts(form.querySelector('select[name="insert_ids"]'), items);
  if (wearing?.diaperId && [...takenOffSelect.options].some(option => option.value === wearing.diaperId)) {
    takenOffSelect.value = wearing.diaperId;
  }
  const putOnAt = form.querySelector('[name="put_on_at"]');
  if (putOnAt && wearing?.putOnAt) {
    putOnAt.value = dateTimeLocal(wearing.putOnAt);
  }
}

async function saveTwoDiaperLog(form, submitter) {
  const ctx = await activeContext();
  if (!ctx) return toast("Please sign in again.");
  const changedInput = form.querySelector('[name="changed_at"]');
  if (changedInput && !changedInput.value) changedInput.value = dateTimeLocal();
  const data = new FormData(form);
  const changedAt = data.get("changed_at") || new Date().toISOString();
  const baseNotes = String(data.get("notes") || "").trim();
  const baseRow = {
    household_id: ctx.household.id,
    diaper_id: data.get("diaper_id") || null,
    put_on_diaper_id: data.get("put_on_diaper_id") || null,
    insert_ids: data.getAll("insert_ids").filter(Boolean),
    happened_at: new Date(changedAt).toISOString(),
    changed_at: new Date(changedAt).toISOString(),
    put_on_at: data.get("put_on_at") ? new Date(data.get("put_on_at")).toISOString() : null,
    day_night: data.get("day_night") || "auto",
    subcategory: null,
    leaked: data.has("leaked"),
    accident: data.has("accident"),
    notes: baseNotes,
    created_by: ctx.session.user.id
  };
  const events = selectedEvents(data);
  const rows = events.map(event => ({
    ...baseRow,
    event,
    notes: events.length > 1 ? `${baseNotes}${baseNotes ? " " : ""}(same change: wet and messed)` : baseNotes
  }));

  const originalText = submitter?.textContent || "Save";
  if (submitter) {
    submitter.disabled = true;
    submitter.textContent = "Saving...";
  }
  let { error } = await supabase.from("logs").insert(rows);
  if (error && /put_on_diaper_id|schema cache|could not find/i.test(error.message || "")) {
    const legacyRows = rows.map(row => {
      const copy = { ...row };
      delete copy.put_on_diaper_id;
      return copy;
    });
    ({ error } = await supabase.from("logs").insert(legacyRows));
  }
  if (submitter) {
    submitter.disabled = false;
    submitter.textContent = originalText;
  }
  if (error) return toast(`Log could not save: ${error.message}`);
  const inventoryError = await decrementInventory(baseRow.put_on_diaper_id, baseRow.insert_ids);
  if (inventoryError) {
    return toast(`Log saved, but inventory did not update: ${inventoryError.message}`);
  }
  toast("Log saved. Inventory updated.");
  document.querySelector('[data-tab="dashboard"]')?.click();
}

function patchForms() {
  document.querySelectorAll("form").forEach(form => {
    if (logFormIds.has(form.id)) patchForm(form).catch(() => {});
  });
}

document.addEventListener("submit", event => {
  const form = event.target;
  if (!logFormIds.has(form?.id) || form.dataset.twoDiaperReady !== "true") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  saveTwoDiaperLog(form, event.submitter).catch(error => toast(error.message));
}, true);

document.addEventListener("click", event => {
  if (event.target.closest("[data-tab], [data-log-my-diaper]")) setTimeout(patchForms, 150);
});

new MutationObserver(patchForms).observe(document.body, { childList: true, subtree: true });
[0, 600, 1500].forEach(delay => setTimeout(patchForms, delay));
