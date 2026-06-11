import { LeaderboardUI } from "./ui/leaderboard";

interface GameMeta {
  label: string;
  description: string;
  factory: () => Destroyable;
  available: boolean;
}

interface Destroyable {
  destroy?(): void;
}

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

const registry = new Map<string, GameMeta>();
let current: Destroyable | null = null;
let openSection: string | null = null;

export const router = {
  register(
    id: string,
    label: string,
    description: string,
    factory: () => Destroyable,
  ): void {
    registry.set(id, { label, description, factory, available: true });
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
  const route = id ? registry.get(id) : undefined;

  if (id === "leaderboard") {
    current = new LeaderboardUI();
  } else if (route?.available) {
    current = route.factory();
  } else {
    renderLobby();
  }
}

function gameEntry(id: string, label: string, description: string): GameEntry {
  return {
    id,
    label,
    description,
    available: registry.get(id)?.available ?? false,
  };
}

function getCategories(): Category[] {
  return [
    {
      name: "Solitaire",
      games: [
        gameEntry(
          "golf",
          "Golf Solitaire",
          "Clear the tableau by playing cards one rank above or below the waste top.",
        ),
        gameEntry(
          "pyramid",
          "Pyramid",
          "Pair exposed cards that sum to 13 to clear the pyramid.",
        ),
        gameEntry(
          "klondike",
          "Klondike",
          "The classic. Build four foundation piles from Ace to King by suit.",
        ),
        gameEntry(
          "freecell",
          "Freecell",
          "All cards face-up. Use four free cells to maneuver cards to the foundations.",
        ),
      ],
    },
    {
      name: "Head-to-Head",
      games: [
        gameEntry(
          "cribbage",
          "Cribbage",
          "Score points through pegging and showing your hand. First to 121 wins.",
        ),
        gameEntry(
          "gin",
          "Gin Rummy",
          "Form melds and knock before the bot does. Score runs and sets.",
        ),
        gameEntry(
          "blackjack",
          "Blackjack",
          "Beat the dealer. Get as close to 21 as you can without going bust.",
        ),
        gameEntry(
          "crazy-eights",
          "Crazy Eights",
          "Match the suit or rank. Play an eight to change suits. First to empty wins.",
        ),
        gameEntry(
          "cuttle",
          "Cuttle",
          "A card duel. Race to 21 points while one-offs and royals disrupt your foe.",
        ),
      ],
    },
    {
      name: "Trick-Taking",
      games: [
        gameEntry(
          "hearts",
          "Hearts",
          "Avoid hearts and the queen of spades across 4 players.",
        ),
        gameEntry(
          "euchre",
          "Euchre",
          "Partnership trick-taking with bowers and trump. First team to 10 wins.",
        ),
        gameEntry(
          "spades",
          "Spades",
          "Bid and take tricks with your partner. Spades are always trump.",
        ),
      ],
    },
  ];
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
}
