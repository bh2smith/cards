import { LeaderboardUI } from "./ui/leaderboard";
import { CatalogUI } from "../catalog/ui";
import { GAMES } from "../games";
import type { GameCategory } from "../games/types";
import type { Destroyable } from "./types";

interface GameEntry {
  id: string;
  label: string;
  description: string;
  available: boolean;
}

interface Category {
  name: string;
  games: GameEntry[];
}

const CATEGORY_ORDER: GameCategory[] = [
  "Solitaire",
  "Head-to-Head",
  "Trick-Taking",
];

const registry = new Map<string, () => Destroyable>();
let current: Destroyable | null = null;
let openSection: string | null = null;

export const router = {
  register(id: string, factory: () => Destroyable): void {
    registry.set(id, factory);
  },

  init(): void {
    window.addEventListener("hashchange", handle);
    handle();
  },
};

function handle(): void {
  if (current?.destroy) current.destroy();
  current = null;

  const id = location.hash.replace(/^#\/?/, "");
  const factory = id ? registry.get(id) : undefined;

  if (id === "leaderboard") {
    current = new LeaderboardUI();
  } else if (id === "rules" || id.startsWith("rules/")) {
    current = new CatalogUI(id.startsWith("rules/") ? id.slice(6) : null);
  } else if (factory) {
    current = factory();
  } else {
    renderLobby();
  }
}

function getCategories(): Category[] {
  return CATEGORY_ORDER.map((name) => ({
    name,
    games: GAMES.filter((m) => m.category === name).map((m) => ({
      id: m.id,
      label: m.title,
      description: m.blurb,
      available: !m.comingSoon && m.load !== undefined,
    })),
  }));
}

function renderLobby(): void {
  const app = document.getElementById("app")!;
  const categories = getCategories();

  app.innerHTML = `
    <div class="lobby">
      <div class="lobby-header">
        <h1>The Card Room</h1>
        <p class="lobby-subtitle">Choose your game</p>
      </div>
      <div class="lobby-categories">
        ${categories
          .map((cat) => {
            const collapsed = openSection !== cat.name;
            return `
            <div class="lobby-category">
              <button class="category-header" data-category="${cat.name}" aria-expanded="${!collapsed}">
                <span class="category-name">${cat.name}</span>
                <span class="category-count">${cat.games.filter((g) => g.available).length}/${cat.games.length}</span>
                <span class="category-chevron">${collapsed ? "▸" : "▾"}</span>
              </button>
              <div class="lobby-grid ${collapsed ? "collapsed" : ""}">
                ${cat.games
                  .map(
                    (g) => `
                  <div class="game-card ${g.available ? "available" : "coming-soon"}" ${g.available ? `data-game="${g.id}"` : ""}>
                    <div class="game-card-name">${g.label}</div>
                    <div class="game-card-desc">${g.description}</div>
                    ${!g.available ? '<div class="game-badge">Coming Soon</div>' : ""}
                  </div>`,
                  )
                  .join("")}
              </div>
            </div>`;
          })
          .join("")}
      </div>
      <div class="lobby-footer">
        <button class="lobby-leaderboard-btn" id="lobby-leaderboard-btn">Leaderboard</button>
        <button class="lobby-leaderboard-btn" id="lobby-rules-btn">Rules Library</button>
      </div>
    </div>
  `;

  app.querySelectorAll<HTMLElement>(".game-card.available").forEach((el) => {
    el.addEventListener("click", () => {
      location.hash = `/${el.dataset.game}`;
    });
  });

  app.querySelectorAll<HTMLElement>(".category-header").forEach((el) => {
    el.addEventListener("click", () => {
      const name = el.dataset.category!;
      openSection = openSection === name ? null : name;
      renderLobby();
    });
  });

  document
    .getElementById("lobby-leaderboard-btn")
    ?.addEventListener("click", () => {
      location.hash = "/leaderboard";
    });

  document.getElementById("lobby-rules-btn")?.addEventListener("click", () => {
    location.hash = "/rules";
  });
}
