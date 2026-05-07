import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

function memberCardFor(button) {
  return button.closest(".item");
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-revoke-member]");
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const memberId = button.dataset.revokeMember;
  if (!memberId) return;
  if (!confirm("Revoke this friend's access?")) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Revoking...";

  const { error } = await supabase
    .from("household_members")
    .update({ status: "revoked" })
    .eq("id", memberId);

  if (error) {
    button.disabled = false;
    button.textContent = originalText;
    showToast(`Could not revoke access: ${error.message}`);
    return;
  }

  const card = memberCardFor(button);
  if (card) {
    const status = card.querySelector("p");
    if (status) status.textContent = status.textContent.replace(/^(pending|active|revoked)/i, "revoked");
    card.querySelector(".share-link")?.closest("label")?.remove();
    button.remove();
    card.style.opacity = ".65";
  }
  showToast("Friend access revoked.");
}, true);
