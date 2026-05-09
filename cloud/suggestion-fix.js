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
  setTimeout(() => toastEl.classList.remove("show"), 2600);
}

async function suggestionContext() {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return null;

  const { data: memberships, error: memberError } = await supabase
    .from("household_members")
    .select("*, households(*)")
    .eq("user_id", session.user.id)
    .eq("status", "active");
  if (memberError) throw memberError;

  const member = memberships?.find(row =>
    row.can_suggest_diaper === true &&
    row.households &&
    row.households.owner_id !== session.user.id
  );
  if (!member?.households) return null;

  const { data: diapers, error: diaperError } = await supabase
    .from("diapers")
    .select("id, brand, style, size, item_type")
    .eq("household_id", member.households.id)
    .in("item_type", ["disposable", "cloth"])
    .order("brand", { ascending: true });
  if (diaperError) throw diaperError;

  return {
    householdId: member.households.id,
    userId: session.user.id,
    diapers: diapers || []
  };
}

function card(ctx) {
  const options = ctx.diapers.map(item =>
    `<option value="${esc(item.id)}">${esc(item.brand)} ${esc(item.style)}${item.size ? ` (${esc(item.size)})` : ""}</option>`
  ).join("");

  return `
    <article class="card" id="friendSuggestionCard">
      <h3>Suggest a Diaper</h3>
      <p>Send a diaper suggestion to the tracker owner.</p>
      <form id="friendSuggestionForm" class="grid" style="margin-top:12px">
        <label>Diaper
          <select name="diaper_id" required>${options}</select>
        </label>
        <label>Message
          <textarea name="note" rows="3" placeholder="Optional note"></textarea>
        </label>
        <button class="btn fox" type="submit" ${options ? "" : "disabled"}>Send Suggestion</button>
      </form>
    </article>
  `;
}

async function injectSuggestionCard() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (title !== "Inventory" || !view || document.getElementById("friendSuggestionCard")) return;

  const ctx = await suggestionContext();
  if (!ctx) return;

  const wrapper = document.createElement("section");
  wrapper.className = "grid two";
  wrapper.style.marginTop = "14px";
  wrapper.innerHTML = card(ctx);

  const inventoryGroups = view.querySelector("section.grid.two:last-of-type");
  if (inventoryGroups) view.insertBefore(wrapper, inventoryGroups);
  else view.appendChild(wrapper);

  wrapper.querySelector("form").addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const diaperId = data.get("diaper_id");
    if (!diaperId) return toast("Pick a diaper first.");
    const { error } = await supabase.from("diaper_suggestions").insert({
      household_id: ctx.householdId,
      diaper_id: diaperId,
      suggested_by: ctx.userId,
      note: String(data.get("note") || "").trim()
    });
    if (error) return toast(`Suggestion could not send: ${error.message}`);
    event.currentTarget.reset();
    toast("Suggestion sent.");
  });
}

new MutationObserver(() => injectSuggestionCard().catch(() => {})).observe(document.getElementById("app"), { childList: true, subtree: true });
setTimeout(() => injectSuggestionCard().catch(() => {}), 0);
