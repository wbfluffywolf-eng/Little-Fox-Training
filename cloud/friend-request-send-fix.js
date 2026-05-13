import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastEl.classList.remove("show"), 2800);
}

function permissionValues() {
  const form = document.getElementById("inviteForm");
  const checked = (name, fallback) => form?.elements[name] ? form.elements[name].checked === true : fallback;
  return {
    can_view_dashboard: checked("can_view_dashboard", true),
    can_view_calendar: checked("can_view_calendar", true),
    can_view_inventory: checked("can_view_inventory", true),
    can_view_trends: checked("can_view_trends", true),
    can_view_expenses: checked("can_view_expenses", false),
    can_view_messages: checked("can_view_messages", true),
    can_send_messages: checked("can_send_messages", true),
    can_view_settings: false,
    can_suggest_diaper: checked("can_suggest_diaper", true),
    can_add_logs: false
  };
}

async function ownerHousehold() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) throw new Error("Sign in before adding friends.");
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role, households(owner_id)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw error;
  const owner = (data || []).find(row => row.role === "owner" || row.households?.owner_id === user.id);
  if (!owner?.household_id) throw new Error("Your personal tracker was not found.");
  return owner.household_id;
}

async function sendFriendRequest(button) {
  button.disabled = true;
  button.textContent = "Sending...";
  try {
    const householdId = await ownerHousehold();
    const email = button.dataset.email;
    const userId = button.dataset.addProfile;
    let { data: existing, error: lookupError } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .maybeSingle();
    if (lookupError) throw lookupError;

    const row = {
      household_id: householdId,
      user_id: userId,
      invite_email: email,
      role: "viewer",
      status: "pending",
      ...permissionValues()
    };

    const result = existing?.id
      ? await supabase.from("household_members").update(row).eq("id", existing.id)
      : await supabase.from("household_members").insert(row);
    if (result.error) throw result.error;
    toast("Friend request sent.");
    setTimeout(() => location.reload(), 500);
  } catch (error) {
    toast(error.message || "Friend request could not be sent.");
    button.disabled = false;
    button.textContent = "Send Request";
  }
}

function patchSearchText() {
  const card = document.getElementById("friendSearchCard");
  if (!card) return;
  const body = card.querySelector("p");
  if (body) body.textContent = "Search for an existing account, then send a friend request. They must accept before either tracker is shared.";
  card.querySelectorAll("[data-add-profile]").forEach(button => {
    if (!button.disabled) button.textContent = "Send Request";
  });
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-add-profile]");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  sendFriendRequest(button);
}, true);

new MutationObserver(patchSearchText).observe(document.getElementById("app"), { childList: true, subtree: true });
patchSearchText();
