import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const dismissedKey = "littleFoxDismissedFriendRequestPopup";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

async function currentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

async function pendingRequests() {
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("household_members")
    .select("id, invite_email, households(name, owner_id)")
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (error) return [];
  return (data || []).filter(row => row.households?.owner_id !== user.id);
}

function updateBadge(count) {
  const tab = document.querySelector("[data-friends-tab]");
  if (!tab) return;
  tab.dataset.baseLabel ||= tab.textContent.replace(/\s+\(\d+\)$/, "") || "Friends";
  tab.textContent = count ? `${tab.dataset.baseLabel} (${count})` : tab.dataset.baseLabel;
  tab.classList.toggle("has-unread", count > 0);
}

function removePopup() {
  document.getElementById("friendRequestPopup")?.remove();
}

function showPopup(requests) {
  if (!requests.length || document.getElementById("friendRequestPopup")) return;
  if (sessionStorage.getItem(dismissedKey) === String(requests.length)) return;
  const first = requests[0];
  document.body.insertAdjacentHTML("beforeend", `
    <aside class="friend-request-popup" id="friendRequestPopup" role="dialog" aria-live="polite">
      <button class="friend-request-popup-close" type="button" data-friend-request-dismiss aria-label="Dismiss">x</button>
      <h3>${requests.length === 1 ? "New Friend Request" : `${requests.length} Friend Requests`}</h3>
      <p>${esc(first.households?.name || first.invite_email || "Someone")} wants to share diaper-use views with you.</p>
      <div class="pill-row">
        <button class="btn fox" type="button" data-open-friend-requests>View Requests</button>
      </div>
    </aside>
  `);
}

async function refreshFriendRequests() {
  const requests = await pendingRequests();
  updateBadge(requests.length);
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  if (title === "Friends") {
    removePopup();
    return;
  }
  showPopup(requests);
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-open-friend-requests]")) {
    removePopup();
    sessionStorage.removeItem(dismissedKey);
    document.querySelector("[data-friends-tab]")?.click();
    return;
  }
  if (event.target.closest("[data-friend-request-dismiss]")) {
    const count = document.querySelector("[data-friends-tab]")?.textContent.match(/\((\d+)\)/)?.[1] || "0";
    sessionStorage.setItem(dismissedKey, count);
    removePopup();
  }
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-tab], [data-friends-tab]")) setTimeout(() => refreshFriendRequests().catch(() => {}), 250);
});

refreshFriendRequests().catch(() => {});
[1000, 4000, 12000].forEach(delay => setTimeout(() => refreshFriendRequests().catch(() => {}), delay));
