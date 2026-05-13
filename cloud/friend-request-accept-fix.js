import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let badgeRefreshTimer = null;
let badgeRefreshRunning = false;
let lastBadgeCount = null;
let requestCardInjected = false;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2800);
}

function mutualDiaperPermissions() {
  return {
    can_view_dashboard: true,
    can_view_calendar: true,
    can_view_inventory: true,
    can_view_trends: true,
    can_view_expenses: false,
    can_view_messages: true,
    can_send_messages: true,
    can_view_settings: false,
    can_suggest_diaper: true,
    can_add_logs: false
  };
}

async function currentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

async function loadActivePersonal(userId) {
  const { data, error } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
  return (data || []).find(row => row.role === "owner" || row.households?.owner_id === userId);
}

async function loadIncomingRequests(userId) {
  const { data, error } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) throw error;
  return (data || []).filter(row => row.role !== "owner" && row.households?.owner_id !== userId && row.households);
}

function setFriendsBadge(count) {
  const button = document.querySelector("[data-friends-tab]");
  if (!button) return;
  if (lastBadgeCount === count && button.dataset.friendRequestCount === String(count)) return;
  lastBadgeCount = count;
  const label = count > 0 ? `Friends (${count})` : "Friends";
  if (button.textContent !== label) button.textContent = label;
  if (button.dataset.friendRequestCount !== String(count)) button.dataset.friendRequestCount = String(count);
}

function requestCardHtml(requests) {
  return `
    <article class="card" id="friendRequestsCard" style="margin-top:14px">
      <h3>Friend Requests</h3>
      <div class="list" style="margin-top:12px">
        ${requests.map(member => `
          <div class="item">
            <div class="item-head">
              <div>
                <h4>${esc(member.households?.name || member.invite_email || "Friend request")}</h4>
                <p>Accept to share diaper-use views with each other.</p>
              </div>
              <button class="btn fox" type="button" data-friend-accept-fix="${esc(member.id)}">Accept</button>
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

async function acceptRequest(requestId) {
  const user = await currentUser();
  if (!user) throw new Error("Sign in before accepting friends.");
  const personal = await loadActivePersonal(user.id);
  if (!personal?.household_id) throw new Error("Your personal tracker was not found.");
  const requests = await loadIncomingRequests(user.id);
  const request = requests.find(row => row.id === requestId);
  if (!request) throw new Error("Friend request was not found.");
  const requesterId = request.households?.owner_id;
  if (!requesterId) throw new Error("Friend request owner was not found.");

  const accepted = await supabase
    .from("household_members")
    .update({ status: "active" })
    .eq("id", request.id)
    .eq("user_id", user.id);
  if (accepted.error) throw accepted.error;

  const { data: existing, error: lookupError } = await supabase
    .from("household_members")
    .select("id")
    .eq("household_id", personal.household_id)
    .eq("user_id", requesterId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const reciprocal = {
    household_id: personal.household_id,
    user_id: requesterId,
    role: "viewer",
    status: "active",
    ...mutualDiaperPermissions()
  };

  const result = existing?.id
    ? await supabase.from("household_members").update(reciprocal).eq("id", existing.id)
    : await supabase.from("household_members").insert(reciprocal);
  if (result.error) throw result.error;
}

async function injectFriendRequests() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (title !== "Friends" || !view || document.getElementById("friendRequestsCard") || view.querySelector("[data-friend-accept]")) return;
  const user = await currentUser();
  if (!user) return;
  const requests = await loadIncomingRequests(user.id);
  setFriendsBadge(requests.length);
  if (!requests.length) return;
  const friendsCard = [...view.querySelectorAll(".card h3")].find(heading => heading.textContent.trim() === "Friends")?.closest(".card");
  if (friendsCard) friendsCard.insertAdjacentHTML("beforebegin", requestCardHtml(requests));
  else view.insertAdjacentHTML("afterbegin", requestCardHtml(requests));
  requestCardInjected = true;
}

async function refreshFriendsBadge() {
  if (badgeRefreshRunning) return;
  badgeRefreshRunning = true;
  const user = await currentUser();
  try {
    if (!user) {
      setFriendsBadge(0);
      return;
    }
    const requests = await loadIncomingRequests(user.id);
    setFriendsBadge(requests.length);
  } finally {
    badgeRefreshRunning = false;
  }
}

function scheduleFriendRequestRefresh() {
  if (badgeRefreshTimer) return;
  badgeRefreshTimer = setTimeout(() => {
    badgeRefreshTimer = null;
    refreshFriendsBadge().catch(() => {});
    if (!requestCardInjected) injectFriendRequests().catch(() => {});
  }, 750);
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-friend-accept-fix]");
  if (!button) return;
  button.disabled = true;
  button.textContent = "Accepting...";
  try {
    await acceptRequest(button.dataset.friendAcceptFix);
    toast("Friend request accepted.");
    setFriendsBadge(0);
    setTimeout(() => location.reload(), 500);
  } catch (error) {
    toast(error.message || "Friend request could not be accepted.");
    button.disabled = false;
    button.textContent = "Accept";
  }
});

new MutationObserver(scheduleFriendRequestRefresh).observe(document.getElementById("app"), { childList: true, subtree: true });
scheduleFriendRequestRefresh();
