import { getEntry } from "../../catalog/index";
import { GAMES } from "../../games";

let backdrop: HTMLElement | null = null;

export function openInstructions(gameId: string): void {
  if (backdrop) return;
  const slug = GAMES.find((m) => m.id === gameId)?.catalogSlug ?? gameId;
  const entry = getEntry(slug);
  if (!entry) return;

  backdrop = document.createElement("div");
  backdrop.className = "instructions-backdrop";
  backdrop.innerHTML = `
    <div class="instructions-modal" role="dialog" aria-label="How to Play">
      <div class="instructions-header">
        <h2>${entry.name}</h2>
        <button id="instructions-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="instructions-body">${entry.rulesHtml}</div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeInstructions();
  });
  backdrop
    .querySelector("#instructions-close")
    ?.addEventListener("click", closeInstructions);
  document.addEventListener("keydown", onKeyDown);
}

function closeInstructions(): void {
  if (!backdrop) return;
  backdrop.remove();
  backdrop = null;
  document.removeEventListener("keydown", onKeyDown);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeInstructions();
}
