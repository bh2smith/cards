import {
  fetchTopLeaderboard,
  fetchMyStats,
  GameId,
  type GameIdValue,
  type LeaderboardEntry,
  type PlayerStats,
} from "../circles/leaderboard";
import {
  isInMiniapp,
  getWalletAddress,
  resolveProfiles,
  type ResolvedProfile,
} from "../circles/miniapp";

const GAME_TABS: Array<{ id: GameIdValue; label: string; solo: boolean }> = [
  { id: GameId.Golf, label: "Golf", solo: true },
  { id: GameId.Pyramid, label: "Pyramid", solo: true },
  { id: GameId.Cribbage, label: "Cribbage", solo: false },
  { id: GameId.Blackjack, label: "Blackjack", solo: false },
  { id: GameId.GinRummy, label: "Gin Rummy", solo: false },
  { id: GameId.Hearts, label: "Hearts", solo: false },
  { id: GameId.Klondike, label: "Klondike", solo: true },
  { id: GameId.CrazyEights, label: "Crazy Eights", solo: false },
  { id: GameId.Freecell, label: "Freecell", solo: true },
  { id: GameId.Cuttle, label: "Cuttle", solo: false },
  { id: GameId.Euchre, label: "Euchre", solo: false },
];

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export class LeaderboardUI {
  private activeGame: GameIdValue = GameId.Golf;
  private entries: LeaderboardEntry[] = [];
  private myStats: PlayerStats | null = null;
  private profiles = new Map<string, ResolvedProfile>();
  private loading = true;

  constructor() {
    document.getElementById("app")!.innerHTML = LeaderboardUI.template();
    this.bindEvents();
    this.load();
  }

  destroy(): void {
    document.getElementById("app")!.innerHTML = "";
  }

  static template(): string {
    return `
      <div class="header">
        <div class="header-left">
          <a href="#" class="back-link">← Games</a>
          <h1>Leaderboard</h1>
        </div>
      </div>

      <div class="lb-tabs" id="lb-tabs">
        ${GAME_TABS.map(
          (g) =>
            `<button class="lb-tab" data-game="${g.id}">${g.label}</button>`,
        ).join("")}
      </div>

      <div id="lb-my-stats" class="lb-my-stats hidden"></div>

      <div class="lb-table-wrap" id="lb-table-wrap">
        <div class="lb-loading">Loading...</div>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("lb-tabs").addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(".lb-tab") as HTMLElement;
      if (!btn) return;
      const gameId = parseInt(btn.dataset.game ?? "0") as GameIdValue;
      if (gameId === this.activeGame) return;
      this.activeGame = gameId;
      this.load();
    });
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.render();

    try {
      const [entries, myStats] = await Promise.all([
        fetchTopLeaderboard(this.activeGame),
        isInMiniapp() ? fetchMyStats(this.activeGame) : null,
      ]);
      this.entries = entries;
      this.myStats = myStats;
    } catch {
      this.entries = [];
      this.myStats = null;
    }

    this.loading = false;
    this.render();

    if (this.entries.length > 0) {
      this.profiles = await resolveProfiles(this.entries.map((e) => e.player));
      this.render();
    }
  }

  private isSolo(): boolean {
    return GAME_TABS.find((g) => g.id === this.activeGame)?.solo ?? false;
  }

  private render(): void {
    this.renderTabs();
    this.renderMyStats();
    this.renderTable();
  }

  private renderTabs(): void {
    const tabs = this.$("lb-tabs");
    tabs.querySelectorAll<HTMLElement>(".lb-tab").forEach((btn) => {
      const id = parseInt(btn.dataset.game ?? "-1");
      btn.classList.toggle("lb-tab-active", id === this.activeGame);
    });
  }

  private renderMyStats(): void {
    const el = this.$("lb-my-stats");
    if (!this.myStats || !isInMiniapp()) {
      el.classList.add("hidden");
      return;
    }

    const s = this.myStats;
    const addr = getWalletAddress();
    const profile = addr ? this.profiles.get(addr.toLowerCase()) : undefined;
    const displayName = profile?.name ?? (addr ? shortAddr(addr) : "");
    const solo = this.isSolo();
    const metric = solo
      ? `<span class="lb-stat"><span class="lb-stat-label">Cards Left</span>${s.totalCardsRemaining}</span>`
      : `<span class="lb-stat"><span class="lb-stat-label">Net</span>${s.wins - s.losses > 0 ? "+" : ""}${s.wins - s.losses}</span>`;

    el.classList.remove("hidden");
    el.innerHTML = `
      <div class="lb-my-stats-label">Your Record${displayName ? ` (${displayName})` : ""}</div>
      <div class="lb-stat-row">
        <span class="lb-stat"><span class="lb-stat-label">W</span>${s.wins}</span>
        <span class="lb-stat"><span class="lb-stat-label">L</span>${s.losses}</span>
        ${metric}
        <span class="lb-stat"><span class="lb-stat-label">Played</span>${s.gamesPlayed}</span>
      </div>
    `;
  }

  private renderTable(): void {
    const wrap = this.$("lb-table-wrap");

    if (this.loading) {
      wrap.innerHTML = `<div class="lb-loading">Loading...</div>`;
      return;
    }

    if (this.entries.length === 0) {
      wrap.innerHTML = `<div class="lb-empty">No results yet. Be the first!</div>`;
      return;
    }

    const solo = this.isSolo();
    const myAddr = getWalletAddress()?.toLowerCase();

    const headerCols = solo
      ? `<th>#</th><th>Player</th><th>W</th><th>L</th><th>Cards</th><th>GP</th>`
      : `<th>#</th><th>Player</th><th>W</th><th>L</th><th>Net</th><th>GP</th>`;

    const rows = this.entries
      .map((entry, i) => {
        const s = entry.stats;
        const isMe = myAddr && entry.player.toLowerCase() === myAddr;
        const cls = isMe ? ' class="lb-row-me"' : "";
        const metric = solo
          ? s.totalCardsRemaining
          : s.wins - s.losses > 0
            ? `+${s.wins - s.losses}`
            : s.wins - s.losses;

        const profile = this.profiles.get(entry.player.toLowerCase());
        const avatar = profile?.imageUrl
          ? `<img class="lb-avatar" src="${profile.imageUrl}" alt="">`
          : `<span class="lb-avatar lb-avatar-placeholder"></span>`;
        const name = profile?.name ?? shortAddr(entry.player);

        return `<tr${cls}>
        <td>${i + 1}</td>
        <td class="lb-player">${avatar}<span class="lb-name">${name}</span></td>
        <td>${s.wins}</td>
        <td>${s.losses}</td>
        <td>${metric}</td>
        <td>${s.gamesPlayed}</td>
      </tr>`;
      })
      .join("");

    wrap.innerHTML = `
      <table class="lb-table">
        <thead><tr>${headerCols}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }
}
