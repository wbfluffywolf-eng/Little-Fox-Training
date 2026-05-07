import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const productionAppUrl = "https://wbfluffywolf-eng.github.io/Little-Fox-Training/cloud/";

function redirectUrl() {
  const current = new URL(window.location.href);
  const useProduction = ["localhost", "127.0.0.1", ""].includes(current.hostname) || current.protocol === "file:";
  const url = new URL(useProduction ? productionAppUrl : window.location.href);
  const invite = current.searchParams.get("invite");
  url.hash = "";
  url.search = "";
  if (invite) url.searchParams.set("invite", invite);
  return url.toString();
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

document.addEventListener("submit", async event => {
  if (event.target?.id !== "authForm") return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const form = new FormData(event.target);
  const mode = event.submitter?.value || "signin";
  const email = form.get("email")?.trim();
  const password = form.get("password");

  const result = mode === "signup"
    ? await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl() }
    })
    : await supabase.auth.signInWithPassword({ email, password });

  if (result.error) {
    showToast(result.error.message);
    return;
  }

  if (mode === "signup" && !result.data.session) {
    showToast("Check your email, then open the confirmation link.");
    return;
  }

  window.location.href = redirectUrl();
}, true);
