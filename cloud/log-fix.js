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

async function householdForCurrentUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) throw new Error("Please sign in again.");

  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role, can_add_logs")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .single();
  if (error) throw error;
  if (!data || (data.role !== "owner" && !data.can_add_logs)) {
    throw new Error("This account does not have permission to add logs.");
  }
  return { householdId: data.household_id, userId: user.id };
}

document.addEventListener("submit", async event => {
  if (event.target?.id !== "logForm") return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const form = event.target;
  const button = form.querySelector("button[type='submit']");
  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }

  try {
    const { householdId, userId } = await householdForCurrentUser();
    const data = new FormData(form);
    const changedAt = data.get("changed_at") || new Date().toISOString();
    const row = {
      household_id: householdId,
      diaper_id: data.get("diaper_id") || null,
      insert_ids: data.getAll("insert_ids").filter(Boolean),
      event: data.get("event"),
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

    let { error } = await supabase.from("logs").insert(row);
    if (error && /insert_ids|changed_at|subcategory/i.test(error.message || "")) {
      const legacyRow = { ...row };
      delete legacyRow.insert_ids;
      delete legacyRow.changed_at;
      delete legacyRow.subcategory;
      const fallback = await supabase.from("logs").insert(legacyRow);
      error = fallback.error;
    }
    if (error) throw error;

    showToast("Log saved.");
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
