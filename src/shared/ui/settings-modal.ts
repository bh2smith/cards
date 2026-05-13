import {
  getSettings,
  setSetting,
  type Settings,
  applySettings,
} from "../settings";

let mounted = false;

export function mountSettings(): void {
  if (mounted) return;
  mounted = true;

  applySettings();

  const btn = document.createElement("button");
  btn.id = "settings-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Settings");
  btn.innerHTML = gearSvg();
  btn.addEventListener("click", openModal);
  document.body.appendChild(btn);
}

function gearSvg(): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>
  </svg>`;
}

let backdrop: HTMLElement | null = null;

function openModal(): void {
  if (backdrop) return;

  backdrop = document.createElement("div");
  backdrop.className = "settings-backdrop";
  backdrop.innerHTML = renderModal(getSettings());
  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  backdrop
    .querySelector("#settings-close")
    ?.addEventListener("click", closeModal);

  backdrop
    .querySelectorAll<HTMLInputElement>("[data-setting]")
    .forEach((el) => {
      el.addEventListener("change", () => {
        const key = el.dataset.setting as keyof Settings;
        setSetting(key, el.checked as Settings[typeof key]);
      });
    });

  document.addEventListener("keydown", onKeyDown);
}

function closeModal(): void {
  if (!backdrop) return;
  backdrop.remove();
  backdrop = null;
  document.removeEventListener("keydown", onKeyDown);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeModal();
}

function renderModal(s: Readonly<Settings>): string {
  return `
    <div class="settings-modal" role="dialog" aria-label="Settings">
      <div class="settings-header">
        <h2>Settings</h2>
        <button id="settings-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="settings-body">
        ${toggleRow("lightTheme", "Light theme", "Warm daytime look — easier on the eyes.", s.lightTheme)}
        ${toggleRow("reduceMotion", "Reduce motion", "Disable card hover and pulse animations.", s.reduceMotion)}
        ${toggleRow("confirmNewGame", "Confirm new game", "Ask before discarding the current round.", s.confirmNewGame)}
      </div>
    </div>
  `;
}

function toggleRow(
  key: keyof Settings,
  label: string,
  hint: string,
  checked: boolean,
): string {
  return `
    <label class="settings-row">
      <span class="settings-row-text">
        <span class="settings-row-label">${label}</span>
        <span class="settings-row-hint">${hint}</span>
      </span>
      <input type="checkbox" data-setting="${key}" ${checked ? "checked" : ""} />
      <span class="settings-switch" aria-hidden="true"></span>
    </label>
  `;
}
