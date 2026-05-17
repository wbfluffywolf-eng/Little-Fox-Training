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
  toast.timer = setTimeout(() => toastEl.classList.remove("show"), 3000);
}

function cleanUsername(value) {
  return String(value || "").trim().toLowerCase().replace(/^@+/, "");
}

async function loadProfile() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return {
    user,
    display_name: data?.display_name || user.email?.split("@")[0] || "Little Fox",
    username: data?.username || user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "_") || ""
  };
}

function profileCard(profile) {
  return `
    <article class="card" id="usernameSettingsCard">
      <h3>Profile</h3>
      <p>Your username is what friends use to find you.</p>
      <form id="usernameSettingsForm" class="grid" style="margin-top:12px">
        <div class="form-grid">
          <label>Display name<input name="display_name" maxlength="40" value="${esc(profile.display_name)}"></label>
          <label>Username<input name="username" required minlength="3" maxlength="24" pattern="[a-z0-9_]{3,24}" value="${esc(profile.username)}"></label>
        </div>
        <p class="muted">Use 3-24 lowercase letters, numbers, or underscores.</p>
        <button class="btn fox" type="submit">Save Profile</button>
      </form>
    </article>
  `;
}

async function injectUsernameSettings() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (title !== "Settings" || !view || document.getElementById("usernameSettingsCard")) return;
  const profile = await loadProfile();
  if (!profile) return;
  view.insertAdjacentHTML("afterbegin", profileCard(profile));
  document.getElementById("usernameSettingsForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const username = cleanUsername(data.get("username"));
    const displayName = String(data.get("display_name") || "").trim() || username;
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      toast("Username must be 3-24 letters, numbers, or underscores.");
      return;
    }
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Saving...";
    const { error } = await supabase.from("profiles").upsert({
      id: profile.user.id,
      email: profile.user.email || "",
      display_name: displayName,
      username
    });
    button.disabled = false;
    button.textContent = "Save Profile";
    if (error) {
      if (/duplicate|unique/i.test(error.message || "")) {
        toast("That username is already taken.");
        return;
      }
      toast(`Profile could not save: ${error.message}`);
      return;
    }
    toast("Profile saved.");
  });
}

document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="settings"]')) setTimeout(() => injectUsernameSettings().catch(() => {}), 120);
});

injectUsernameSettings().catch(() => {});
[500, 1500, 3000].forEach(delay => setTimeout(() => injectUsernameSettings().catch(() => {}), delay));
