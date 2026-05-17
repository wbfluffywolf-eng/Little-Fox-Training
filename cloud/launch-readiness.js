import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const APP_VERSION = "v73";
const LATEST_LINK = "https://wbfluffywolf-eng.github.io/Little-Fox-Training/cloud/?v=73";

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

function currentTitle() {
  return document.querySelector(".topbar h2")?.textContent.trim() || "";
}

function injectStyles() {
  if (document.getElementById("launchReadinessStyles")) return;
  const style = document.createElement("style");
  style.id = "launchReadinessStyles";
  style.textContent = `
    .launch-note {
      display: grid;
      gap: 6px;
      margin: 12px 0 14px;
      padding: 12px;
      border: 1px solid rgba(38, 49, 58, 0.12);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.72);
      color: #26313a;
      text-align: left;
    }
    .launch-note strong,
    .launch-card h3 {
      color: #1f2a33;
    }
    .launch-note span,
    .launch-card li,
    .launch-card p {
      color: #5c6875;
    }
    .launch-card .button-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }
    .launch-checklist {
      display: grid;
      gap: 8px;
      margin: 12px 0;
      padding: 0;
      list-style: none;
    }
    .launch-checklist li {
      display: grid;
      grid-template-columns: 24px 1fr;
      align-items: start;
      gap: 8px;
    }
    .launch-checklist li::before {
      content: "";
      width: 14px;
      height: 14px;
      margin-top: 4px;
      border: 2px solid #f97316;
      border-radius: 4px;
      background: #fff;
    }
    .launch-link {
      word-break: break-word;
      font-weight: 800;
      color: #26313a;
    }
  `;
  document.head.appendChild(style);
}

async function getUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user || null;
}

async function loadProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", user.id)
    .maybeSingle();
  return { user, username: data?.username || "" };
}

function usernameLooksGenerated(profile) {
  const local = profile.user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "_") || "";
  return !profile.username || profile.username === local;
}

async function injectUsernamePrompt() {
  const view = document.getElementById("view");
  if (!view || currentTitle() === "Settings" || document.getElementById("usernamePromptCard")) return;
  const profile = await loadProfile();
  if (!profile || !usernameLooksGenerated(profile)) return;
  view.insertAdjacentHTML("afterbegin", `
    <article class="card launch-card" id="usernamePromptCard">
      <h3>Set Your Username</h3>
      <p>Friends need your username to find you. Open Settings and save a username before sharing the app widely.</p>
      <button class="btn fox" type="button" data-open-settings-readiness>Open Settings</button>
    </article>
  `);
}

function friendlyToastMessage(message) {
  if (/new row violates row-level security policy for table "messages"|row-level security.*messages/i.test(message)) {
    return "Message could not send. Make sure both people accepted the friend request and Messages permission is enabled.";
  }
  if (/duplicate key value violates unique constraint/i.test(message)) {
    return "That friend request already exists. Ask them to check the Friends tab for the request.";
  }
  if (/row-level security|violates row-level|policy/i.test(message)) {
    return "That action was blocked by account permissions. Refresh the app and make sure both people accepted the friend request.";
  }
  if (/choose a diaper before sending a diaper ping/i.test(message)) {
    return "Choose one of your friend's visible diapers before sending a diaper ping.";
  }
  return message;
}

function watchToasts() {
  const toastEl = document.getElementById("toast");
  if (!toastEl || toastEl.dataset.launchReadinessWatched) return;
  toastEl.dataset.launchReadinessWatched = "true";
  new MutationObserver(() => {
    const next = friendlyToastMessage(toastEl.textContent || "");
    if (next && next !== toastEl.textContent) toastEl.textContent = next;
  }).observe(toastEl, { childList: true, characterData: true, subtree: true });
}

function patchAuthCard() {
  const card = document.querySelector(".auth-card");
  if (!card || document.getElementById("authLaunchNote")) return;
  const paragraph = card.querySelector("p");
  if (paragraph && /loading secure cloud app/i.test(paragraph.textContent)) return;
  if (paragraph && !/invite/i.test(paragraph.textContent)) {
    paragraph.textContent = "Create an account, set a username, add friends, and choose what each friend can see.";
  }
  const form = card.querySelector("form");
  const note = document.createElement("div");
  note.className = "launch-note";
  note.id = "authLaunchNote";
  note.innerHTML = `
    <strong>Getting started</strong>
    <span>1. Sign in or create an account.</span>
    <span>2. Open Settings and set a username.</span>
    <span>3. Add friends by username, then wait for them to accept.</span>
  `;
  if (form) form.before(note);
  else card.appendChild(note);
}

async function injectDashboardQuickStart() {
  const view = document.getElementById("view");
  if (!view || currentTitle() !== "Dashboard" || document.getElementById("dashboardQuickStartCard")) return;
  if (!(await getUser())) return;
  view.insertAdjacentHTML("afterbegin", `
    <article class="card launch-card" id="dashboardQuickStartCard">
      <h3>Quick Start</h3>
      <ul class="launch-checklist">
        <li>Set a username in Settings.</li>
        <li>Add friends by username.</li>
        <li>They must accept before sharing starts.</li>
        <li>Use Messages for diaper pings and diaper checks.</li>
      </ul>
      <button class="btn fox" type="button" data-open-settings-readiness>Open Settings</button>
    </article>
  `);
}

async function injectSettingsReadiness() {
  const view = document.getElementById("view");
  if (!view || currentTitle() !== "Settings" || document.getElementById("launchReadinessCard")) return;
  if (!(await getUser())) return;
  view.insertAdjacentHTML("beforeend", `
    <article class="card launch-card" id="launchReadinessCard">
      <h3>Before Inviting Friends</h3>
      <p>Run this quick check before sending the app to a bunch of people.</p>
      <ul class="launch-checklist">
        <li>Open the app on your phone and confirm signup and login both work.</li>
        <li>Set a username so friends can search without using email.</li>
        <li>Add one brand-new friend account by username.</li>
        <li>Accept or deny the friend request from the Friends tab.</li>
        <li>Send a message both ways.</li>
        <li>Send a diaper ping using the friend's visible inventory.</li>
        <li>Send a diaper check and reply with a photo plus wet, dry, or messy.</li>
        <li>Log a diaper change and confirm inventory count changes.</li>
        <li>Confirm friends cannot open your Settings or private areas.</li>
      </ul>
      <p><strong>Cache note:</strong> if the app looks old, open the latest link and fully close then reopen the app.</p>
      <p><a class="launch-link" href="${esc(LATEST_LINK)}">${esc(LATEST_LINK)}</a></p>
      <div class="button-row">
        <button class="btn secondary" type="button" data-copy-latest-link>Copy Latest Link</button>
      </div>
      <p class="muted">Current release: Little Fox Training Cloud ${esc(APP_VERSION)}</p>
    </article>
  `);
}

function refreshLaunchCards() {
  injectStyles();
  watchToasts();
  patchAuthCard();
  injectDashboardQuickStart().catch(() => {});
  injectSettingsReadiness().catch(() => {});
  injectUsernamePrompt().catch(() => {});
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-open-settings-readiness]")) {
    document.querySelector('[data-tab="settings"]')?.click();
    setTimeout(refreshLaunchCards, 150);
  }
  if (event.target.closest("[data-copy-latest-link]")) {
    navigator.clipboard?.writeText(LATEST_LINK).then(() => toast("Latest app link copied.")).catch(() => {
      toast(LATEST_LINK);
    });
  }
  if (event.target.closest("[data-tab]")) setTimeout(refreshLaunchCards, 200);
});

const observer = new MutationObserver(() => refreshLaunchCards());
observer.observe(document.body, { childList: true, subtree: true });

[0, 500, 1500, 3000].forEach(delay => setTimeout(refreshLaunchCards, delay));
