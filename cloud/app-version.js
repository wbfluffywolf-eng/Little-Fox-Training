const APP_VERSION = "v61";

function injectAppVersion() {
  const title = document.querySelector(".topbar h2")?.textContent.trim();
  const view = document.getElementById("view");
  if (title !== "Settings" || !view || document.getElementById("appVersionCard")) return;

  const card = document.createElement("article");
  card.className = "card";
  card.id = "appVersionCard";
  card.innerHTML = `
    <h3>App Version</h3>
    <p>Little Fox Training Cloud ${APP_VERSION}</p>
  `;
  view.appendChild(card);
}

document.addEventListener("click", event => {
  if (event.target.closest('[data-tab="settings"]')) setTimeout(injectAppVersion, 100);
});

[0, 500, 1500, 3000].forEach(delay => setTimeout(injectAppVersion, delay));
