import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) {
    alert(message);
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3600);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function selectedEvents(data) {
  const events = [];
  if (data.has("event_wet")) events.push("wet");
  if (data.has("event_messed")) events.push("messed");
  if (data.has("event_dry")) return ["dry"];
  const legacyEvent = data.get("event");
  return events.length ? events : [legacyEvent || "wet"];
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
  if (!writable) {
    throw new Error("This account does not have permission to add logs.");
  }
  return { householdId: writable.household_id, userId: user.id };
}

document.addEventListener("submit", async event => {
  if (event.target?.id !== "logForm") return;
  if (event.target.querySelector('[name="put_on_diaper_id"]')) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const form = event.target;
  form.dataset.logFixHandlesMultiEvent = "true";
  const button = form.querySelector("button[type='submit']");
  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }

  try {
    const { householdId, userId } = await householdForCurrentUser();
    const data = new FormData(form);
    const changedAt = data.get("changed_at") || new Date().toISOString();
    const baseRow = {
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
      ...baseRow,
      event: name,
      notes: events.length > 1 ? `${baseRow.notes}${baseRow.notes ? " " : ""}(same change: wet and messed)` : baseRow.notes
    }));

    let { error } = await supabase.from("logs").insert(rows);
    if (error && /insert_ids|changed_at|subcategory/i.test(error.message || "")) {
      const legacyRows = rows.map(row => {
        const legacyRow = { ...row };
        delete legacyRow.insert_ids;
        delete legacyRow.changed_at;
        delete legacyRow.subcategory;
        return legacyRow;
      });
      const fallback = await supabase.from("logs").insert(legacyRows);
      error = fallback.error;
    }
    if (error) throw error;

    const inventoryError = await decrementInventory(baseRow.diaper_id, baseRow.insert_ids);
    if (inventoryError) {
      showToast(`Log saved, but inventory did not update: ${inventoryError.message}`);
      window.setTimeout(() => window.location.reload(), 1400);
      return;
    }

    showToast(events.length > 1 ? "Wet and messed log saved. Inventory updated." : "Log saved. Inventory updated.");
    window.setTimeout(() => window.location.reload(), 700);
  } catch (error) {
    console.error("Daily log save failed", error);
    showToast(`Log could not save: ${error.message}`);
    if (button) {
      button.disabled = false;
      button.textContent = "Save Log";
    }
  }
}, true);
