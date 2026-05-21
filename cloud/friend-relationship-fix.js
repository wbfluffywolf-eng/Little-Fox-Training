import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function toast(message) {
  window.dispatchEvent(new CustomEvent("littlefox:toast", { detail: message }));
}

function bool(form, key) {
  return form.has(key);
}

async function getOwnerHousehold(userId) {
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role, households(owner_id)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw error;
  const rows = data || [];
  return rows.find(row => row.role === "owner" || row.households?.owner_id === userId)?.household_id || rows[0]?.household_id;
}

async function saveFriendAccess(event) {
  const formEl = event.target;
  if (!(formEl instanceof HTMLFormElement) || formEl.id !== "inviteForm") return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const button = formEl.querySelector("button[type='submit']");
  if (button) button.disabled = true;

  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) throw new Error("Sign in before adding a friend.");

    const form = new FormData(formEl);
    const email = String(form.get("email") || "").trim().toLowerCase();
    if (!email) throw new Error("Enter a friend's email first.");

    const householdId = await getOwnerHousehold(user.id);
    if (!householdId) throw new Error("Your personal tracker was not found.");

    const row = {
      household_id: householdId,
      invite_email: email,
      role: "viewer",
      status: "pending",
      can_view_dashboard: bool(form, "can_view_dashboard"),
      can_view_calendar: bool(form, "can_view_calendar"),
      can_view_inventory: bool(form, "can_view_inventory"),
      can_view_trends: bool(form, "can_view_trends"),
      can_view_expenses: bool(form, "can_view_expenses"),
      can_view_settings: false,
      can_suggest_diaper: bool(form, "can_suggest_diaper"),
      can_view_messages: bool(form, "can_view_messages"),
      can_send_messages: bool(form, "can_send_messages"),
      can_add_logs: false
    };

    const { data: existing, error: lookupError } = await supabase
      .from("household_members")
      .select("id, user_id")
      .eq("household_id", householdId)
      .ilike("invite_email", email)
      .maybeSingle();

    if (lookupError) throw lookupError;

    let result;
    if (existing?.id) {
      const updates = { ...row, status: existing.user_id ? "active" : "pending" };
      delete updates.household_id;
      result = await supabase.from("household_members").update(updates).eq("id", existing.id);
      if (result.error && /can_view_messages|can_send_messages/i.test(result.error.message || "")) {
        delete updates.can_view_messages;
        delete updates.can_send_messages;
        result = await supabase.from("household_members").update(updates).eq("id", existing.id);
      }
    } else {
      result = await supabase.from("household_members").insert(row);
      if (result.error && /can_view_messages|can_send_messages/i.test(result.error.message || "")) {
        const legacyRow = { ...row };
        delete legacyRow.can_view_messages;
        delete legacyRow.can_send_messages;
        result = await supabase.from("household_members").insert(legacyRow);
      }
    }

    if (result.error) throw result.error;
    toast(existing?.user_id ? "Friend access restored." : "Invite created. Send them the friend link from Members.");
    setTimeout(() => window.location.reload(), 450);
  } catch (error) {
    toast(error.message || "Friend access could not be saved.");
  } finally {
    if (button) button.disabled = false;
  }
}

document.addEventListener("submit", saveFriendAccess, true);
