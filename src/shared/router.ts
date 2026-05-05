interface GameMeta {
  label: string;
  description: string;
  factory: () => Destroyable;
  available: boolean;
}

interface Destroyable {
  destroy?(): void;
}

const registry = new Map<string, GameMeta>();
let current: Destroyable | null = null;

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

  if (route?.available) {
    current = route.factory();
  } else {
    renderLobby();
  }
}

function renderLobby(): void {
  const app = document.getElementById("app")!;

  const allGames: Array<{
    id: string;
    label: string;
    description: string;
    available: boolean;
  }> = [
    {
      id: "cribbage",
      label: "Cribbage",
      description:
        "Score points through pegging and showing your hand. First to 121 wins.",
      available: registry.get("cribbage")?.available ?? false,
    },
    {
      id: "golf",
      label: "Golf Solitaire",
      description:
        "Clear the tableau by playing cards one rank above or below the waste top.",
      available: registry.get("golf")?.available ?? false,
    },
    {
      id: "blackjack",
      label: "Blackjack",
      description:
        "Beat the dealer. Get as close to 21 as you can without going bust.",
      available: false,
    },
    {
      id: "pyramid",
      label: "Pyramid",
      description: "Pair exposed cards that sum to 13 to clear the pyramid.",
      available: false,
    },
    {
      id: "gin",
      label: "Gin Rummy",
      description:
        "Form melds and knock before the bot does. Score runs and sets.",
      available: false,
    },
    {
      id: "hearts",
      label: "Hearts",
      description: "Avoid hearts and the queen of spades across 4 players.",
      available: false,
    },
  ];

  app.innerHTML = `
    <div class="lobby">
      <div class="lobby-header">
        <h1>The Card Room</h1>
        <p class="lobby-subtitle">Choose your game</p>
      </div>
      <div class="lobby-grid">
        ${allGames
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
    </div>
  `;

  app.querySelectorAll<HTMLElement>(".game-card.available").forEach((el) => {
    el.addEventListener("click", () => {
      location.hash = `/${el.dataset.game}`;
    });
  });
}
