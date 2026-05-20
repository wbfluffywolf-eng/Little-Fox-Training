import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) {
    alert(message);
    return;
  }
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastEl.classList.remove("show"), 3600);
}

async function ensureAnonymousTracker(user) {
  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email || "",
    display_name: "Little Fox"
  });

  const { data: memberships, error: memberLoadError } = await supabase
    .from("household_members")
    .select("id, role, household_id, households(owner_id)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (memberLoadError) throw memberLoadError;

  const hasOwnerTracker = (memberships || []).some(row =>
    row.role === "owner" || row.households?.owner_id === user.id
  );
  if (hasOwnerTracker) return;

  const { data: household, error: householdError } = await supabase
    .from("households")
    .insert({ owner_id: user.id, name: "My Diaper Tracker" })
    .select()
    .single();
  if (householdError) throw householdError;

  const ownerMember = {
    household_id: household.id,
    user_id: user.id,
    invite_email: null,
    role: "owner",
    status: "active",
    can_view_dashboard: true,
    can_view_calendar: true,
    can_view_inventory: true,
    can_view_trends: true,
    can_view_expenses: true,
    can_view_settings: true,
    can_suggest_diaper: true,
    can_view_messages: true,
    can_send_messages: true,
    can_add_logs: true
  };
  const { error: insertError } = await supabase.from("household_members").insert(ownerMember);
  if (!insertError) return;

  const legacyMember = { ...ownerMember };
  delete legacyMember.can_view_messages;
  delete legacyMember.can_send_messages;
  delete legacyMember.can_add_logs;
  const { error: legacyError } = await supabase.from("household_members").insert(legacyMember);
  if (legacyError) throw legacyError;
}

function addAnonymousButton() {
  const form = document.getElementById("authForm");
  if (!form || document.getElementById("anonymousAuthCard")) return;
  if (new URLSearchParams(window.location.search).get("invite")) return;

  form.insertAdjacentHTML("afterend", `
    <div class="launch-note" id="anonymousAuthCard" style="margin-top:12px">
      <strong>Private start</strong>
      <span>Use this if you do not want to use an email yet.</span>
      <button class="btn secondary" id="anonymousSignInBtn" type="button">Start Without Email</button>
      <span>Anonymous accounts stay on this browser. Set a username right away, and add a backup login later if you want to keep the account across devices.</span>
    </div>
  `);

  document.getElementById("anonymousSignInBtn")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Starting...";
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (!data.session?.user) throw new Error("Anonymous sign-in did not return a session.");
      await ensureAnonymousTracker(data.session.user);
      window.location.reload();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Start Without Email";
      toast(`Anonymous sign-in could not start: ${error.message}`);
    }
  });
}

new MutationObserver(addAnonymousButton).observe(document.body, { childList: true, subtree: true });
addAnonymousButton();
