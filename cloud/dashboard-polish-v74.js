function currentTabTitle() {
  return document.querySelector(".topbar h2")?.textContent.trim() || "";
}

function updateAddLogVisibility() {
  const isDashboard = currentTabTitle() === "Dashboard";
  document.querySelectorAll('.topbar [data-tab="log"]').forEach(button => {
    button.hidden = !isDashboard;
    button.style.display = isDashboard ? "" : "none";
  });
}

function eventParts(text) {
  const match = String(text || "").match(/^(Wet|Messed) on (.+)$/i);
  if (!match) return null;
  return { event: match[1].toLowerCase(), when: match[2] };
}

function itemDiaperText(item) {
  return item.querySelector(".item-head p")?.textContent.trim() || "";
}

function isSameWetMessChange(a, b) {
  const aTitle = eventParts(a.querySelector("h4")?.textContent);
  const bTitle = eventParts(b.querySelector("h4")?.textContent);
  if (!aTitle || !bTitle || aTitle.when !== bTitle.when || aTitle.event === bTitle.event) return false;
  if (itemDiaperText(a) !== itemDiaperText(b)) return false;
  const combinedText = `${a.textContent} ${b.textContent}`;
  return /\(same change:\s*wet and messed\)/i.test(combinedText);
}

function mergeRecentPair(primary, duplicate) {
  const primaryTitle = eventParts(primary.querySelector("h4")?.textContent);
  const duplicateTitle = eventParts(duplicate.querySelector("h4")?.textContent);
  if (!primaryTitle) return;
  const title = primary.querySelector("h4");
  title.textContent = `Wet and Messed on ${primaryTitle.when}`;
  title.dataset.mergedWetMess = "true";

  const primaryButton = primary.querySelector("[data-delete-log]");
  const duplicateButton = duplicate.querySelector("[data-delete-log]");
  if (primaryButton && duplicateButton) {
    primaryButton.textContent = `Delete ${primaryTitle.event}`;
    duplicateButton.textContent = `Delete ${duplicateTitle?.event || "other"}`;
    primaryButton.after(duplicateButton);
  }

  duplicate.remove();
}

function collapseWetMessRecentActivity() {
  if (currentTabTitle() !== "Dashboard") return;
  const recentHeading = [...document.querySelectorAll(".card h3")].find(heading => heading.textContent.trim() === "Recent Activity");
  const list = recentHeading?.closest(".card")?.querySelector(".list");
  if (!list) return;
  const items = [...list.querySelectorAll(":scope > .item")];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item.querySelector("h4")?.dataset.mergedWetMess === "true") continue;
    const match = items.slice(i + 1).find(other => isSameWetMessChange(item, other));
    if (match) mergeRecentPair(item, match);
  }
}

function refreshDashboardPolish() {
  updateAddLogVisibility();
  collapseWetMessRecentActivity();
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-tab], [data-my-tracker], [data-friends-my-dashboard]")) {
    setTimeout(refreshDashboardPolish, 120);
    setTimeout(refreshDashboardPolish, 500);
  }
});

new MutationObserver(refreshDashboardPolish).observe(document.body, { childList: true, subtree: true });

[0, 300, 800, 1600, 3000].forEach(delay => setTimeout(refreshDashboardPolish, delay));
