const inviteParam = new URLSearchParams(window.location.search).get("invite") || "";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function friendLink(email) {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  url.searchParams.set("invite", email);
  return url.toString();
}

function improveInviteLogin() {
  const email = inviteParam.trim().toLowerCase();
  if (!email) return;
  const input = document.querySelector("#authForm input[name='email']");
  if (!input) return;
  if (!input.value) input.value = email;
  const note = document.querySelector(".auth-card p");
  if (note) note.textContent = `Create an account with ${email} to accept this friend invite.`;
}

function addFriendLinks() {
  document.querySelectorAll(".item").forEach(item => {
    if (item.dataset.friendLinkReady === "true") return;
    const title = item.querySelector("h4")?.textContent?.trim() || "";
    const status = item.querySelector("p")?.textContent || "";
    if (!title.includes("@") || status.includes("owner")) return;
    const label = document.createElement("label");
    label.innerHTML = `Friend link<input class="share-link" readonly value="${escapeHtml(friendLink(title.toLowerCase()))}">`;
    label.querySelector("input").addEventListener("focus", event => event.currentTarget.select());
    item.querySelector(".item-head")?.insertAdjacentElement("afterend", label);
    item.dataset.friendLinkReady = "true";
  });
}

function applyFriendLinkFixes() {
  improveInviteLogin();
  addFriendLinks();
}

new MutationObserver(applyFriendLinkFixes).observe(document.body, { childList: true, subtree: true });
applyFriendLinkFixes();
