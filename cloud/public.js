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

function imageFileToDataUrl(file) {
  if (!file || !file.type.startsWith("image/")) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image could not be loaded."));
      img.onload = () => {
        const max = 1100;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function loadPublicFeed() {
  const session = await currentSession();
  if (!session) return null;

  const posts = await supabase
    .from("public_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(25);
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
          <div>
            <h4>${esc(post.author_name || "Little Fox")}</h4>
            <p>${esc(new Date(post.created_at).toLocaleString())}</p>
          </div>
        </div>
        <span class="pill ${hasPawed ? "owner" : "viewer"}">\uD83D\uDC3E ${paws.length}</span>
      </div>
      <p>${esc(post.body)}</p>
      ${post.image_data ? `<img class="post-image" src="${esc(post.image_data)}" alt="Public post attachment" loading="lazy">` : ""}
      <div class="pill-row" style="margin-top:10px">
        <button class="btn secondary" type="button" data-paw-post="${esc(post.id)}">${hasPawed ? "\uD83D\uDC3E Pawed" : "\uD83D\uDC3E Paw"}</button>
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
  if (subtitle) subtitle.textContent = "Public posts";
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
    <article class="card">
      <h3>Post to Public</h3>
      <form id="publicPostForm" class="grid" style="margin-top:12px">
        <label class="field-full">What's new?<textarea name="body" maxlength="1500" placeholder="Share an update with everyone on the app"></textarea></label>
        <label class="field-full">Picture<input type="file" name="image" accept="image/*"></label>
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
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  button.textContent = "Posting...";
  const imageData = await imageFileToDataUrl(data.get("image")).catch(error => {
    toast(error.message);
    return "";
  });
  const body = String(data.get("body") || "").trim() || (imageData ? "Photo" : "");
  if (!body) {
    button.disabled = false;
    button.textContent = "Post";
    toast("Add text or a picture before posting.");
    return;
  }
  const post = {
    author_id: ctx.session.user.id,
    author_name: publicName(ctx.session.user),
    body,
    image_data: imageData || null
  };
  const { error } = await supabase.from("public_posts").insert(post);
  if (error) {
    button.disabled = false;
    button.textContent = "Post";
    if (/image_data|schema cache/i.test(error.message || "")) {
      toast("Run media-schema.sql in Supabase to enable social pictures.");
      return;
    }
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

document.addEventListener("click", event => {
  if (event.target.closest("[data-public-tab]")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    renderPublic();
    return;
  }
  if (event.target.closest("[data-tab]")) setTimeout(injectPublicTab, 100);
}, true);

[0, 500, 1500, 3000].forEach(delay => setTimeout(injectPublicTab, delay));
