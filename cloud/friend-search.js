import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

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
  return { user, householdId: owner.household_id };
}

function searchCardHtml() {
  return `
    <article class="card" id="friendSearchCard">
      <h3>Add Friend</h3>
      <p>Search for an existing account, then choose what that friend can see in your tracker.</p>
      <form id="friendSearchForm" class="grid" style="margin-top:12px">
        <label>Email or name<input name="search" type="search" required autocomplete="off" placeholder="friend@example.com"></label>
        <button class="btn fox" type="submit">Search</button>
      </form>
      <div id="friendSearchResults" class="list" style="margin-top:12px"></div>
    </article>
  `;
}

function hideInviteLinks() {
  document.querySelectorAll(".share-link").forEach(input => input.closest("label")?.remove());
  const inviteTitle = [...document.querySelectorAll(".card h3")].find(heading => heading.textContent.trim() === "Invite Friend");
  if (inviteTitle) {
    inviteTitle.textContent = "Friend Permissions";
    const body = inviteTitle.parentElement?.querySelector("p");
    if (body) body.textContent = "Use these checkboxes before adding a friend from search.";
    inviteTitle.parentElement?.querySelector("label > input[name='email']")?.closest("label")?.remove();
    inviteTitle.parentElement?.querySelector("button[type='submit']")?.remove();
  }
}

async function runSearch(event) {
  event.preventDefault();
  const results = document.getElementById("friendSearchResults");
  const form = event.currentTarget;
  const query = String(new FormData(form).get("search") || "").trim();
  if (!query) return;
  results.innerHTML = `<div class="empty">Searching...</div>`;
  const { user } = await ownerHousehold();
  const { data, error } = await supabase.rpc("search_profiles", { search_text: query });
  if (error) {
    results.innerHTML = `<div class="empty">Run the latest Supabase schema to enable account search.</div>`;
    return;
  }
  const rows = (data || []).filter(row => row.id !== user.id);
  results.innerHTML = rows.map(row => `
    <div class="item">
      <div class="item-head">
        <div>
          <h4>${esc(row.display_name || row.email)}</h4>
          <p>${esc(row.email)}</p>
        </div>
        <button class="btn secondary" type="button" data-add-profile="${esc(row.id)}" data-email="${esc(row.email)}">Add</button>
      </div>
    </div>
  `).join("") || `<div class="empty">No matching accounts found.</div>`;
}

async function addProfile(button) {
  button.disabled = true;
  button.textContent = "Adding...";
  try {
    const { householdId } = await ownerHousehold();
    const email = button.dataset.email;
    const userId = button.dataset.addProfile;
    const row = {
      household_id: householdId,
      user_id: userId,
      invite_email: email,
      role: "viewer",
      status: "active",
      ...permissionValues()
    };

    let { data: existing, error: lookupError } = await supabase
      .from("household_members")
      .select("id")
      .eq("household_id", householdId)
      .eq("user_id", userId)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing?.id) {
      const inviteLookup = await supabase
        .from("household_members")
        .select("id")
        .eq("household_id", householdId)
        .ilike("invite_email", email)
        .maybeSingle();
      if (inviteLookup.error) throw inviteLookup.error;
      existing = inviteLookup.data;
    }

    const result = existing?.id
      ? await supabase.from("household_members").update({ ...permissionValues(), status: "active", user_id: userId, invite_email: email }).eq("id", existing.id)
      : await supabase.from("household_members").insert(row);
    if (result.error) throw result.error;
    toast("Friend added.");
    setTimeout(() => location.reload(), 500);
  } catch (error) {
    toast(error.message || "Friend could not be added.");
    button.disabled = false;
    button.textContent = "Add";
  }
}

function injectFriendSearch() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (title !== "Settings" || !view) return;
  hideInviteLinks();
  if (!document.getElementById("friendSearchCard")) {
    view.insertAdjacentHTML("afterbegin", searchCardHtml());
    document.getElementById("friendSearchForm")?.addEventListener("submit", runSearch);
  }
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-add-profile]");
  if (button) addProfile(button);
});

new MutationObserver(injectFriendSearch).observe(document.getElementById("app"), { childList: true, subtree: true });
injectFriendSearch();
