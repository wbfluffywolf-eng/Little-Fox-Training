function removeInventorySuggestions() {
  document.getElementById("friendSuggestionCard")?.closest("section")?.remove();
  document.getElementById("inventorySuggestForm")?.closest(".card")?.remove();
}

new MutationObserver(removeInventorySuggestions).observe(document.getElementById("app"), { childList: true, subtree: true });
document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="inventory"]')) setTimeout(removeInventorySuggestions, 100);
});
removeInventorySuggestions();
[500, 1500, 3000].forEach(delay => setTimeout(removeInventorySuggestions, delay));
