import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const profileAvatarKey = "littleFoxSocialAvatar";
const avatarOptions = [
  ["need-diaper", "../assets/profile-need-diaper.png", "Need diaper"],
  ["face-cover", "../assets/profile-face-cover.png", "Shy"],
  ["oh-no", "../assets/profile-oh-no.png", "Oh no"],
  ["wag-wag", "../assets/profile-wag-wag.png", "Wag wag"],
  ["ych", "../assets/profile-ych.png", "YCH"],
  ["heart", "../assets/profile-heart.png", "Heart"]
].map(([id, src, label]) => ({ id, src, label }));

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function toast(message) {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3000);
}

async function currentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

function publicName(user) {
  return user.user_metadata?.display_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Little Fox";
}

function selectedAvatarId() {
  const saved = localStorage.getItem(profileAvatarKey);
  return avatarOptions.some(option => option.id === saved) ? saved : "wag-wag";
}

function avatarSrc(id) {
  return avatarOptions.find(option => option.id === id)?.src || avatarOptions[3].src;
}

function avatarPickerHtml(ctx) {
  const selected = selectedAvatarId();
  return `
    <article class="card social-profile-card">
      <div class="social-profile-head">
        <img class="social-avatar large" src="${esc(avatarSrc(selected))}" alt="">
        <div>
          <h3>Social Profile</h3>
          <p>${esc(publicName(ctx.session.user))} posts with this profile picture.</p>
        </div>
      </div>
      <div class="avatar-grid" aria-label="Choose profile picture">
        ${avatarOptions.map(option => `
          <button class="avatar-choice ${option.id === selected ? "active" : ""}" type="button" data-avatar-choice="${esc(option.id)}" title="${esc(option.label)}">
            <img src="${esc(option.src)}" alt="${esc(option.label)}">
          </button>
        `).join("")}
      </div>
    </article>
  `;
}

async function loadPublicFeed() {
  const session = await currentSession();
  if (!session) return null;

  const posts = await supabase
    .from("public_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);
  if (posts.error) return { session, posts: [], paws: [], error: posts.error };

  const ids = (posts.data || []).map(post => post.id);
  const paws = ids.length
    ? await supabase.from("public_post_paws").select("*").in("post_id", ids)
    : { data: [], error: null };
  return {
    session,
    posts: posts.data || [],
    paws: paws.data || [],
    error: paws.error
  };
}

function postHtml(ctx, post) {
  const paws = ctx.paws.filter(paw => paw.post_id === post.id);
  const hasPawed = paws.some(paw => paw.user_id === ctx.session.user.id);
  const canDelete = post.author_id === ctx.session.user.id;
  return `
    <div class="item">
      <div class="item-head">
        <div class="post-author">
          <img class="social-avatar" src="${esc(avatarSrc(post.author_avatar))}" alt="">
          <div>
            <h4>${esc(post.author_name || "Little Fox")}</h4>
            <p>${esc(new Date(post.created_at).toLocaleString())}</p>
          </div>
        </div>
        <span class="pill ${hasPawed ? "owner" : "viewer"}">${paws.length} paws</span>
      </div>
      <p>${esc(post.body)}</p>
      <div class="pill-row" style="margin-top:10px">
        <button class="btn secondary" type="button" data-paw-post="${esc(post.id)}">${hasPawed ? "Pawed" : "Paw"}</button>
        ${canDelete ? `<button class="btn secondary" type="button" data-delete-public-post="${esc(post.id)}">Delete</button>` : ""}
      </div>
    </div>
  `;
}

async function renderPublic() {
  const view = document.getElementById("view");
  if (!view) return;
  const title = document.querySelector(".topbar h2");
  const subtitle = document.querySelector(".topbar p");
  if (title) title.textContent = "Social";
  if (subtitle) subtitle.textContent = "Public posts and profile pictures";
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.publicTab === "true"));

  const ctx = await loadPublicFeed();
  if (!ctx) {
    view.innerHTML = `<div class="empty">Sign in to view the public feed.</div>`;
    return;
  }
  if (ctx.error) {
    view.innerHTML = `<article class="card"><h3>Public Setup Needed</h3><p>Run public-schema.sql in Supabase to enable public posts and paws.</p></article>`;
    return;
  }

  view.innerHTML = `
    ${avatarPickerHtml(ctx)}
    <article class="card">
      <h3>Post to Public</h3>
      <form id="publicPostForm" class="grid" style="margin-top:12px">
        <label class="field-full">What's new?<textarea name="body" required maxlength="1500" placeholder="Share an update with everyone on the app"></textarea></label>
        <button class="btn fox" type="submit">Post</button>
      </form>
    </article>
    <article class="card" style="margin-top:14px">
      <h3>Public Feed</h3>
      <div class="list" style="margin-top:12px">
        ${ctx.posts.map(post => postHtml(ctx, post)).join("") || `<div class="empty">No public posts yet.</div>`}
      </div>
    </article>
  `;
  view.querySelectorAll("[data-avatar-choice]").forEach(button => {
    button.addEventListener("click", () => {
      localStorage.setItem(profileAvatarKey, button.dataset.avatarChoice);
      renderPublic();
    });
  });
  document.getElementById("publicPostForm")?.addEventListener("submit", event => savePublicPost(event, ctx));
  view.querySelectorAll("[data-paw-post]").forEach(button => {
    button.addEventListener("click", () => togglePaw(button.dataset.pawPost, ctx));
  });
  view.querySelectorAll("[data-delete-public-post]").forEach(button => {
    button.addEventListener("click", () => deletePublicPost(button.dataset.deletePublicPost));
  });
}

async function savePublicPost(event, ctx) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const body = data.get("body").trim();
  if (!body) return;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Posting...";
  const post = {
    author_id: ctx.session.user.id,
    author_name: publicName(ctx.session.user),
    author_avatar: selectedAvatarId(),
    body
  };
  let { error } = await supabase.from("public_posts").insert(post);
  if (error && /author_avatar/i.test(error.message || "")) {
    delete post.author_avatar;
    const fallback = await supabase.from("public_posts").insert(post);
    error = fallback.error;
  }
  if (error) {
    button.disabled = false;
    button.textContent = "Post";
    toast(`Post could not save: ${error.message}`);
    return;
  }
  toast("Posted to Public.");
  renderPublic();
}

async function togglePaw(postId, ctx) {
  const existing = ctx.paws.find(paw => paw.post_id === postId && paw.user_id === ctx.session.user.id);
  const result = existing
    ? await supabase.from("public_post_paws").delete().eq("id", existing.id)
    : await supabase.from("public_post_paws").insert({ post_id: postId, user_id: ctx.session.user.id });
  if (result.error) {
    toast(`Paw could not update: ${result.error.message}`);
    return;
  }
  renderPublic();
}

async function deletePublicPost(postId) {
  const { error } = await supabase.from("public_posts").delete().eq("id", postId);
  if (error) {
    toast(`Post could not delete: ${error.message}`);
    return;
  }
  toast("Post deleted.");
  renderPublic();
}

function injectPublicTab() {
  const tabs = document.querySelector(".tabs");
  if (!tabs || document.querySelector("[data-public-tab]")) return;
  const button = document.createElement("button");
  button.className = "tab";
  button.type = "button";
  button.dataset.publicTab = "true";
  button.textContent = "Social";
  const messages = tabs.querySelector('[data-tab="messages"]');
  const settings = tabs.querySelector('[data-tab="settings"]');
  tabs.insertBefore(button, messages || settings || null);
  button.addEventListener("click", renderPublic);
}

new MutationObserver(injectPublicTab).observe(document.getElementById("app"), { childList: true, subtree: true });
injectPublicTab();
