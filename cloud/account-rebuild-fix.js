const selectedKey = "littleFoxSelectedSharedTracker";
const forcePersonalKey = "littleFoxForcePersonalTracker";
const pendingFriendKey = "littleFoxPendingFriendView";

const personalTabs = new Set(["dashboard", "log", "inventory", "calendar", "trends", "cloth", "expenses", "settings", "messages"]);

function friendViewIsPending() {
  return Boolean(sessionStorage.getItem(pendingFriendKey));
}

function forceOwnTracker() {
  sessionStorage.removeItem(selectedKey);
  sessionStorage.setItem(forcePersonalKey, "1");
}

function isFriendsPage() {
  return document.querySelector("[data-friends-tab].active") || document.querySelector(".topbar h2")?.textContent.trim() === "Friends";
}

function removeDashboardFriendCards() {
  document.getElementById("sharedTrackerCard")?.remove();
  document.querySelectorAll(".card h3").forEach(heading => {
    const text = heading.textContent.trim();
    if (text === "Shared Diaper Trackers" || text === "Shared Diaper Tracker") {
      heading.closest(".card")?.remove();
    }
  });
}

function removePersonalSuggestionCards() {
  if (sessionStorage.getItem(selectedKey)) return;
  document.getElementById("friendSuggestionCard")?.remove();
  document.getElementById("inventorySuggestForm")?.closest(".card")?.remove();
  document.getElementById("suggestForm")?.closest(".card")?.remove();
  document.querySelectorAll("button").forEach(button => {
    if (button.textContent.trim() === "Suggest Diaper") button.remove();
  });
}

function removeFriendUsageFromMainTabs() {
  if (isFriendsPage()) return;
  document.querySelectorAll("[data-open-shared-tracker], [data-my-tracker]").forEach(button => button.remove());
  document.querySelectorAll(".card h3").forEach(heading => {
    const text = heading.textContent.trim();
    if (text === "Shared Diaper Trackers" || text === "Shared Diaper Tracker" || text === "Friend Tracker") {
      heading.closest(".card")?.remove();
    }
  });
}

function ensureLogButtonForPersonalTabs() {
  if (isFriendsPage()) return;
  const topbarActions = document.querySelector(".topbar .pill-row");
  if (!topbarActions || topbarActions.querySelector("[data-log-my-diaper]")) return;
  const button = document.createElement("button");
  button.className = "btn fox";
  button.type = "button";
  button.dataset.logMyDiaper = "true";
  button.dataset.tab = "log";
  button.textContent = "Log My Diaper";
  topbarActions.prepend(button);
}

function recoverReadOnlyDailyLog() {
  if (friendViewIsPending()) return;
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const subtitle = document.querySelector(".topbar p")?.textContent.trim().toLowerCase() || "";
  const hasOnlySuggest = Boolean(document.querySelector("#view [data-tab='inventory'], #view #suggestForm, #view #friendSuggestionCard"));
  if ((title === "Daily Log" && subtitle.includes("read-only")) || (title === "Daily Log" && hasOnlySuggest)) {
    forceOwnTracker();
    location.reload();
  }
}

function keepOwnTrackerDefault() {
  if (!friendViewIsPending() && !isFriendsPage()) {
    sessionStorage.removeItem(selectedKey);
    sessionStorage.setItem(forcePersonalKey, "1");
  }
  removeDashboardFriendCards();
  removePersonalSuggestionCards();
  removeFriendUsageFromMainTabs();
  ensureLogButtonForPersonalTabs();
  recoverReadOnlyDailyLog();
}

document.addEventListener("click", event => {
  const tab = event.target.closest("[data-tab]")?.dataset.tab;
  if (event.target.closest("[data-friends-my-log], [data-friends-my-dashboard], [data-log-my-diaper]") || personalTabs.has(tab)) {
    forceOwnTracker();
  }
});

new MutationObserver(keepOwnTrackerDefault).observe(document.getElementById("app"), { childList: true, subtree: true });
keepOwnTrackerDefault();
