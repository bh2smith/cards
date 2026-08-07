import {
  fetchTopLeaderboard,
  fetchFriendsLeaderboard,
  fetchMyStats,
  GameId,
  type GameIdValue,
  type LeaderboardEntry,
  type PlayerStats,
} from "../circles/leaderboard";
import {
  isConnected,
  getWalletAddress,
  fetchTrustedAddresses,
  resolveProfiles,
  onSessionChange,
  type ResolvedProfile,
} from "../circles/miniapp";
import type { Address } from "viem";
import { GAMES } from "../../games";

type Scope = "global" | "friends";

const GAME_TABS: Array<{ id: GameIdValue; label: string; solo: boolean }> =
  GAMES.filter((m) => m.gameId !== undefined)
    .sort((a, b) => a.gameId! - b.gameId!)
    .map((m) => ({
      id: m.gameId!,
      label: m.tabLabel ?? m.title,
      solo: m.solo === true,
    }));

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export class LeaderboardUI {
  private activeGame: GameIdValue = GameId.Golf;
  private scope: Scope = "global";
  private entries: LeaderboardEntry[] = [];
  private myStats: PlayerStats | null = null;
  private profiles = new Map<string, ResolvedProfile>();
  private loading = true;
  private loadToken = 0;
  private unsubscribe: () => void;

  constructor() {
    document.getElementById("app")!.innerHTML = LeaderboardUI.template();
    this.bindEvents();
    // Re-fetch when the user logs in or out while viewing the board.
    this.unsubscribe = onSessionChange(() => this.load());
    this.load();
  }

  destroy(): void {
    this.unsubscribe();
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

      <div class="lb-scope hidden" id="lb-scope">
        <button class="lb-scope-btn" data-scope="global">Global</button>
        <button class="lb-scope-btn" data-scope="friends">My Circle</button>
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

    this.$("lb-scope").addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(
        ".lb-scope-btn",
      ) as HTMLElement;
      if (!btn) return;
      const scope = btn.dataset.scope as Scope;
      if (scope === this.scope) return;
      this.scope = scope;
      this.load();
    });
  }

  private async load(): Promise<void> {
    const token = ++this.loadToken;
    this.loading = true;
    this.render();

    let entries: LeaderboardEntry[] = [];
    let myStats: PlayerStats | null = null;
    try {
      [entries, myStats] = await Promise.all([
        this.scope === "friends"
          ? this.fetchFriendsEntries()
          : fetchTopLeaderboard(this.activeGame),
        isConnected() ? fetchMyStats(this.activeGame) : null,
      ]);
    } catch {
      // fall through with empty entries
    }
    if (token !== this.loadToken) return;

    this.entries = entries;
    this.myStats = myStats;
    this.loading = false;
    this.render();

    if (this.entries.length > 0) {
      const profiles = await resolveProfiles(this.entries.map((e) => e.player));
      if (token !== this.loadToken) return;
      this.profiles = profiles;
      this.render();
    }
  }

  private async fetchFriendsEntries(): Promise<LeaderboardEntry[]> {
    const me = getWalletAddress();
    const trusted = await fetchTrustedAddresses();
    const players = [
      ...new Set([...(me ? [me.toLowerCase()] : []), ...trusted]),
    ] as Address[];
    return fetchFriendsLeaderboard(this.activeGame, this.isSolo(), players);
  }

  private isSolo(): boolean {
    return GAME_TABS.find((g) => g.id === this.activeGame)?.solo ?? false;
  }

  private render(): void {
    this.renderTabs();
    this.renderScope();
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

  private renderScope(): void {
    const el = this.$("lb-scope");
    el.classList.toggle("hidden", !isConnected());
    el.querySelectorAll<HTMLElement>(".lb-scope-btn").forEach((btn) => {
      btn.classList.toggle(
        "lb-scope-btn-active",
        btn.dataset.scope === this.scope,
      );
    });
  }

  private renderMyStats(): void {
    const el = this.$("lb-my-stats");
    if (!this.myStats || !isConnected()) {
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
      wrap.innerHTML =
        this.scope === "friends"
          ? `<div class="lb-empty">No one in your circle has played this game yet. Spread the word!</div>`
          : `<div class="lb-empty">No results yet. Be the first!</div>`;
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
