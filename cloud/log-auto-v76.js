const autoSlotKey = "littleFoxAutoDayNightSlots";
const defaultSlots = {
  morning: "05:00",
  day: "08:00",
  evening: "17:00",
  before_bed: "20:00",
  night: "22:00"
};

function currentTitle() {
  return document.querySelector(".topbar h2")?.textContent.trim() || "";
}

function loadSlots() {
  try {
    return { ...defaultSlots, ...JSON.parse(localStorage.getItem(autoSlotKey) || "{}") };
  } catch {
    return { ...defaultSlots };
  }
}

function saveSlots(slots) {
  localStorage.setItem(autoSlotKey, JSON.stringify(slots));
}

function minutes(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return Math.max(0, Math.min(1439, (hour || 0) * 60 + (minute || 0)));
}

function slotForDate(value) {
  const date = value ? new Date(value) : new Date();
  const now = date.getHours() * 60 + date.getMinutes();
  const slots = loadSlots();
  const starts = {
    morning: minutes(slots.morning),
    day: minutes(slots.day),
    evening: minutes(slots.evening),
    before_bed: minutes(slots.before_bed),
    night: minutes(slots.night)
  };
  if (now >= starts.night || now < starts.morning) return "night";
  if (now >= starts.before_bed) return "before_bed";
  if (now >= starts.evening) return "evening";
  if (now >= starts.day) return "day";
  return "morning";
}

function slotLabel(value) {
  return {
    auto: "Auto",
    morning: "Morning change",
    day: "Day",
    evening: "Evening",
    before_bed: "Before bed",
    night: "Night"
  }[value] || value;
}

function ensureEveningOption(select) {
  if (!select || select.querySelector('option[value="evening"]')) return;
  const option = document.createElement("option");
  option.value = "evening";
  option.textContent = "Evening";
  const beforeBed = select.querySelector('option[value="before_bed"]');
  select.insertBefore(option, beforeBed || null);
}

function applyAutoDayNight(form) {
  const select = form?.querySelector?.('select[name="day_night"]');
  if (!select || select.value !== "auto") return;
  const changedAt = form.querySelector('[name="changed_at"]')?.value;
  const resolved = slotForDate(changedAt);
  ensureEveningOption(select);
  select.value = resolved;
}

function updateAutoPreview(form) {
  const select = form?.querySelector?.('select[name="day_night"]');
  const changedAt = form?.querySelector?.('[name="changed_at"]');
  const preview = form?.querySelector?.("[data-auto-slot-preview]");
  if (!select || !changedAt || !preview) return;
  const resolved = slotForDate(changedAt.value);
  preview.textContent = select.value === "auto" ? `Auto will save as ${slotLabel(resolved)}.` : `Manual: ${slotLabel(select.value)}.`;
}

function injectStyles() {
  if (document.getElementById("logAutoV76Styles")) return;
  const style = document.createElement("style");
  style.id = "logAutoV76Styles";
  style.textContent = `
    .log-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .log-auto-menu-wrap {
      position: relative;
    }
    .log-auto-menu {
      display: none;
      position: absolute;
      right: 0;
      top: calc(100% + 8px);
      z-index: 20;
      width: min(320px, 82vw);
      padding: 12px;
      border: 1px solid rgba(38, 49, 58, 0.16);
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 12px 32px rgba(38, 49, 58, 0.18);
    }
    .log-auto-menu.open {
      display: grid;
      gap: 10px;
    }
    .log-auto-menu .form-grid {
      gap: 8px;
    }
    .log-auto-menu p {
      margin: 0;
      color: #5c6875;
    }
  `;
  document.head.appendChild(style);
}

function menuHtml(slots) {
  return `
    <div class="log-auto-menu-wrap">
      <button class="btn secondary" type="button" data-log-auto-menu aria-label="Auto time settings">...</button>
      <div class="log-auto-menu" data-log-auto-panel>
        <strong>Auto Time Slots</strong>
        <p>Used when Day / Night is set to Auto.</p>
        <div class="form-grid">
          <label>Morning starts<input type="time" name="morning" value="${slots.morning}"></label>
          <label>Day starts<input type="time" name="day" value="${slots.day}"></label>
          <label>Evening starts<input type="time" name="evening" value="${slots.evening}"></label>
          <label>Before bed starts<input type="time" name="before_bed" value="${slots.before_bed}"></label>
          <label>Night starts<input type="time" name="night" value="${slots.night}"></label>
        </div>
        <button class="btn fox" type="button" data-save-auto-slots>Save Times</button>
      </div>
    </div>
  `;
}

function enhanceLogCard(form) {
  if (!form || form.dataset.autoSlotsReady === "true") return;
  injectStyles();
  const select = form.querySelector('select[name="day_night"]');
  const changedAt = form.querySelector('[name="changed_at"]');
  if (!select || !changedAt) return;
  ensureEveningOption(select);
  const card = form.closest(".card");
  const heading = card?.querySelector("h3");
  if (heading && !card.querySelector("[data-log-auto-menu]")) {
    const title = heading.textContent;
    heading.outerHTML = `<div class="log-card-head"><h3>${title}</h3>${menuHtml(loadSlots())}</div>`;
  }
  const label = select.closest("label");
  if (label && !form.querySelector("[data-auto-slot-preview]")) {
    label.insertAdjacentHTML("beforeend", `<p class="muted" data-auto-slot-preview></p>`);
  }
  select.addEventListener("change", () => updateAutoPreview(form));
  changedAt.addEventListener("change", () => updateAutoPreview(form));
  form.dataset.autoSlotsReady = "true";
  updateAutoPreview(form);
}

function enhanceLogForms() {
  document.querySelectorAll("#logForm, #clothWearForm").forEach(enhanceLogCard);
}

function saveMenu(button) {
  const panel = button.closest("[data-log-auto-panel]");
  if (!panel) return;
  const formData = new FormData();
  panel.querySelectorAll("input[type='time']").forEach(input => formData.set(input.name, input.value));
  const next = { ...loadSlots() };
  Object.keys(defaultSlots).forEach(key => {
    next[key] = formData.get(key) || defaultSlots[key];
  });
  saveSlots(next);
  panel.classList.remove("open");
  document.querySelectorAll("#logForm, #clothWearForm").forEach(updateAutoPreview);
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = "Auto time slots saved.";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2600);
  }
}

function hideExtraPerformanceCards() {
  if (currentTitle() !== "Trends") return;
  const performance = document.getElementById("diaperPerformanceCard");
  if (!performance) return;
  [...document.querySelectorAll(".card h3")].forEach(heading => {
    const title = heading.textContent.trim();
    if (title === "Diaper Usage" || title === "Cloth Cost Per Wear") {
      heading.closest(".card")?.remove();
    }
  });
}

document.addEventListener("click", event => {
  const menuButton = event.target.closest("[data-log-auto-menu]");
  if (menuButton) {
    const panel = menuButton.parentElement?.querySelector("[data-log-auto-panel]");
    panel?.classList.toggle("open");
    return;
  }
  const saveButton = event.target.closest("[data-save-auto-slots]");
  if (saveButton) {
    saveMenu(saveButton);
    return;
  }
  if (event.target.closest('#logForm button[type="submit"], #clothWearForm button[type="submit"]')) {
    applyAutoDayNight(event.target.closest("form"));
    return;
  }
  if (event.target.closest("[data-tab]")) {
    setTimeout(enhanceLogForms, 120);
    setTimeout(hideExtraPerformanceCards, 700);
  }
});

document.addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  const form = event.target.closest?.("#logForm, #clothWearForm");
  if (form) applyAutoDayNight(form);
}, true);

new MutationObserver(() => {
  enhanceLogForms();
  hideExtraPerformanceCards();
}).observe(document.body, { childList: true, subtree: true });

[0, 300, 900, 1800, 3200].forEach(delay => setTimeout(() => {
  enhanceLogForms();
  hideExtraPerformanceCards();
}, delay));
