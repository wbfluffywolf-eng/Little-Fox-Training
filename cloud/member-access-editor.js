import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const PERMISSIONS = [
  ["can_view_dashboard", "Dashboard"],
  ["can_view_calendar", "Daily log / Calendar"],
  ["can_view_inventory", "Inventory / Cloth"],
  ["can_view_trends", "Trends"],
  ["can_view_expenses", "Expenses"],
  ["can_view_messages", "Messages"],
  ["can_send_messages", "Can send messages"],
  ["can_view_settings", "Settings"],
  ["can_suggest_diaper", "Can suggest diaper"]
];

function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function renderPermissionForm(member) {
  return `
    <form class="grid member-access-form" data-member-access-form="${esc(member.id)}" style="margin-top:12px">
      <p>Change what this friend can see or do in your shared tracker.</p>
      <div class="form-grid">
        ${PERMISSIONS.map(([name, label]) => `
          <label>
            <span><input type="checkbox" name="${name}" ${member[name] ? "checked" : ""}> ${esc(label)}</span>
          </label>
        `).join("")}
      </div>
      <div class="pill-row">
        <button class="btn fox" type="submit">Save Access</button>
        <button class="btn secondary" type="button" data-cancel-member-access>Cancel</button>
      </div>
    </form>
  `;
}

async function openEditor(memberId, item) {
  const existing = item.querySelector(".member-access-form");
  if (existing) {
    existing.remove();
    return;
  }

  const { data, error } = await supabase
    .from("household_members")
    .select("*")
    .eq("id", memberId)
    .single();

  if (error) {
    toast(`Could not load access: ${error.message}`);
    return;
  }

  item.insertAdjacentHTML("beforeend", renderPermissionForm(data));
}

async function saveEditor(event) {
  const form = event.target.closest("[data-member-access-form]");
  if (!form) return;
  event.preventDefault();

  const memberId = form.dataset.memberAccessForm;
  const updates = Object.fromEntries(PERMISSIONS.map(([name]) => [name, form.elements[name]?.checked === true]));
  const button = form.querySelector("button[type='submit']");
  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }

  const { error } = await supabase
    .from("household_members")
    .update(updates)
    .eq("id", memberId);

  if (button) {
    button.disabled = false;
    button.textContent = "Save Access";
  }

  if (error) {
    toast(`Could not save access: ${error.message}`);
    return;
  }

  toast("Friend access updated.");
  form.remove();
}

function enhanceMemberList() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  if (title !== "Settings") return;

  document.querySelectorAll("[data-revoke-member]").forEach(revokeButton => {
    const item = revokeButton.closest(".item");
    const memberId = revokeButton.dataset.revokeMember;
    if (!item || !memberId || item.querySelector("[data-edit-member-access]")) return;

    const button = document.createElement("button");
    button.className = "btn secondary";
    button.type = "button";
    button.dataset.editMemberAccess = memberId;
    button.textContent = "Edit Access";

    const actions = document.createElement("div");
    actions.className = "pill-row member-access-actions";
    actions.style.marginTop = "10px";
    actions.appendChild(button);
    revokeButton.replaceWith(actions);
    actions.appendChild(revokeButton);
  });
}

document.addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit-member-access]");
  if (editButton) {
    openEditor(editButton.dataset.editMemberAccess, editButton.closest(".item"));
    return;
  }

  const cancelButton = event.target.closest("[data-cancel-member-access]");
  if (cancelButton) {
    cancelButton.closest(".member-access-form")?.remove();
  }
});

document.addEventListener("submit", saveEditor);

const observer = new MutationObserver(enhanceMemberList);
observer.observe(document.getElementById("app"), { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", enhanceMemberList);
