const selectedKey = "littleFoxSelectedSharedTracker";
const forcePersonalKey = "littleFoxForcePersonalTracker";
const pendingFriendKey = "littleFoxPendingFriendView";

function friendViewIsPending() {
  return Boolean(sessionStorage.getItem(pendingFriendKey));
}

function forceOwnTracker() {
  sessionStorage.removeItem(selectedKey);
  sessionStorage.setItem(forcePersonalKey, "1");
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
}

function recoverReadOnlyDailyLog() {
  if (friendViewIsPending()) return;
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const subtitle = document.querySelector(".topbar p")?.textContent.trim().toLowerCase() || "";
  const hasOnlySuggest = Boolean(document.querySelector("#view [data-tab='inventory'], #view #suggestForm, #view #friendSuggestionCard"));
  if (title === "Daily Log" && subtitle.includes("read-only") && hasOnlySuggest) {
    forceOwnTracker();
    location.reload();
  }
}

function keepOwnTrackerDefault() {
  if (!friendViewIsPending() && !sessionStorage.getItem(selectedKey)) {
    sessionStorage.setItem(forcePersonalKey, "1");
  }
  removeDashboardFriendCards();
  removePersonalSuggestionCards();
  recoverReadOnlyDailyLog();
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-friends-my-log], [data-friends-my-dashboard], [data-tab='dashboard'], [data-tab='log']")) {
    forceOwnTracker();
  }
});

new MutationObserver(keepOwnTrackerDefault).observe(document.getElementById("app"), { childList: true, subtree: true });
keepOwnTrackerDefault();
