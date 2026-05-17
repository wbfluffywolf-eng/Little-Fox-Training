import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const selectedSharedKey = "littleFoxSelectedSharedTracker";
const forcePersonalKey = "littleFoxForcePersonalTracker";
const pendingFriendKey = "littleFoxPendingFriendView";

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3000);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]));
}

async function ownerContext() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;
  const { data, error } = await supabase
    .from("household_members")
    .select("id, role, household_id, households(id, owner_id, name)")
    .eq("user_id", session.user.id)
    .eq("status", "active");
  if (error) throw error;
  const owner = data?.find(row => row.role === "owner" || row.households?.owner_id === session.user.id);
  return owner?.households ? { session, member: owner, household: owner.households } : null;
}

function viewingFriendOnPurpose() {
  return Boolean(sessionStorage.getItem(selectedSharedKey) || sessionStorage.getItem(pendingFriendKey));
}

async function recoverOwnerCalendar() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  if (!["Dashboard", "Calendar", "Daily Log", "Trends"].includes(title || "")) return;
  if (viewingFriendOnPurpose()) return;
  const ctx = await ownerContext();
  if (!ctx) return;
  const subtitle = document.querySelector(".topbar p")?.textContent.trim().toLowerCase() || "";
  const brand = document.querySelector(".brand p")?.textContent || "";
  if (subtitle.includes("shared") || subtitle.includes("restricted") || !brand.includes(ctx.household.name)) {
    sessionStorage.removeItem(selectedSharedKey);
    sessionStorage.setItem(forcePersonalKey, "1");
    location.reload();
  }
}

function settingsAlreadyHasRename() {
  return Boolean(document.getElementById("trackerNameForm"));
}

async function injectTrackerRename() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (title !== "Settings" || !view || settingsAlreadyHasRename()) return;
  const ctx = await ownerContext();
  if (!ctx) return;

  const card = document.createElement("article");
  card.className = "card";
  card.id = "trackerNameCard";
  card.innerHTML = `
    <h3>Tracker Name</h3>
    <form id="trackerNameForm" class="grid" style="margin-top:12px">
      <label>Name<input name="name" maxlength="60" required value="${esc(ctx.household.name || "My Diaper Tracker")}"></label>
      <button class="btn fox" type="submit">Save Tracker Name</button>
    </form>
  `;
  view.prepend(card);
  card.querySelector("form").addEventListener("submit", async event => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") || "").trim();
    if (name.length < 2) return toast("Tracker name is too short.");
    const { error } = await supabase.from("households").update({ name }).eq("id", ctx.household.id);
    if (error) return toast(`Tracker name could not save: ${error.message}`);
    toast("Tracker name saved.");
    setTimeout(() => location.reload(), 400);
  });
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-tab]")) {
    setTimeout(() => recoverOwnerCalendar().catch(() => {}), 150);
    setTimeout(() => injectTrackerRename().catch(() => {}), 200);
  }
});

[500, 1500, 3000].forEach(delay => {
  setTimeout(() => recoverOwnerCalendar().catch(() => {}), delay);
  setTimeout(() => injectTrackerRename().catch(() => {}), delay);
});
