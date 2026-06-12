import { Suit } from "typedeck";
import { FreecellGame } from "./game";
import { renderCard } from "../../shared/ui/cards";
import { SUIT_SYMBOL } from "../../shared/deck";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";
import { LeaderboardReporter, GameId } from "../../shared/circles/leaderboard";
import { getWalletAddress } from "../../shared/circles/miniapp";
import { consumeChallenge, type Challenge } from "../../shared/challenge";
import {
  showChallengeBanner,
  showChallengeOutcome,
  showChallengeShare,
  clearChallengeUi,
} from "../../shared/ui/challenge";

const FOUNDATION_SUITS = [Suit.Clubs, Suit.Spades, Suit.Diamonds, Suit.Hearts];

export class FreecellUI {
  private game: FreecellGame;
  private reporter = new LeaderboardReporter(GameId.Freecell);
  private autoCompleteTimer: ReturnType<typeof setInterval> | null = null;
  private challenge: Challenge | null;

  constructor() {
    document.getElementById("app")!.innerHTML = FreecellUI.template();
    this.challenge = consumeChallenge("freecell");
    this.game = new FreecellGame(this.challenge?.seed);
    this.bindEvents();
    if (this.challenge) showChallengeBanner(this.challenge);
    this.render();
  }

  destroy(): void {
    if (this.autoCompleteTimer) clearInterval(this.autoCompleteTimer);
    document.getElementById("app")!.innerHTML = "";
  }

  static template(): string {
    return `
      <div class="header">
        <div class="header-left">
          <a href="#" class="back-link">← Games</a>
          <h1>Freecell</h1>
        </div>
        <div class="header-right">
          <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
          <button id="new-game-btn">New Deal</button>
        </div>
      </div>

      <div class="scoreboard freecell-scoreboard">
        <div class="score-row">
          <span class="score-label">Deal</span>
          <span class="score-value" id="deal-number">—</span>
        </div>
        <div class="score-row">
          <span class="score-label">Moves</span>
          <span class="score-value" id="move-count">0</span>
        </div>
      </div>

      <div class="freecell-top-row">
        <div class="freecell-cells" id="freecell-cells"></div>
        <div class="freecell-foundations" id="freecell-foundations"></div>
      </div>

      <div class="freecell-tableau" id="freecell-tableau"></div>

      <div class="message-bar" id="message"></div>

      <div class="action-area freecell-actions">
        <button id="undo-btn">Undo</button>
        <button id="restart-btn">Restart</button>
        <button id="give-up-btn">Give Up</button>
        <button id="action-btn" class="hidden">Back to Game Room</button>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private goToLobby(): void {
    location.hash = "/";
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("freecell"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Deal a new game?", () => {
        this.challenge = null;
        clearChallengeUi();
        this.game.newDeal();
        this.render();
      }),
    );
    this.$("undo-btn").addEventListener("click", () => {
      this.game.undo();
      this.render();
    });
    this.$("restart-btn").addEventListener("click", () =>
      confirmIfEnabled("Restart this deal?", () => {
        clearChallengeUi();
        if (this.challenge) showChallengeBanner(this.challenge);
        this.game.restart();
        this.render();
      }),
    );
    this.$("give-up-btn").addEventListener("click", () =>
      confirmIfEnabled("Give up this game?", () => {
        this.game.giveUp();
        this.render();
      }),
    );
    this.$("action-btn").addEventListener("click", () => this.goToLobby());
    this.$("freecell-cells").addEventListener("click", (e) =>
      this.onFreeCellClick(e),
    );
    this.$("freecell-foundations").addEventListener("click", (e) =>
      this.onFoundationClick(e),
    );
    this.$("freecell-tableau").addEventListener("click", (e) =>
      this.onTableauClick(e),
    );
  }

  private onFreeCellClick(e: Event): void {
    if (this.autoCompleteTimer) return;
    const cellEl = (e.target as HTMLElement).closest(
      ".freecell-cell",
    ) as HTMLElement;
    if (!cellEl) return;
    const cell = parseInt(cellEl.dataset.cell ?? "-1");
    if (cell < 0) return;

    const state = this.game.getState();
    const card = state.freeCells[cell];
    // Clicking an already-selected occupied cell sends it to a foundation if possible.
    if (
      card &&
      state.selected?.type === "free" &&
      state.selected.cell === cell
    ) {
      const idx = this.game.canAutoFoundation(card);
      if (idx >= 0) {
        this.game.selectFoundation(idx);
        this.render();
        return;
      }
    }

    this.game.selectFreeCell(cell);
    this.render();
  }

  private onFoundationClick(e: Event): void {
    if (this.autoCompleteTimer) return;
    const el = (e.target as HTMLElement).closest(
      ".freecell-foundation",
    ) as HTMLElement;
    if (!el) return;
    const suitIndex = parseInt(el.dataset.suit ?? "-1");
    if (suitIndex < 0) return;
    this.game.selectFoundation(suitIndex);
    this.render();
  }

  private onTableauClick(e: Event): void {
    if (this.autoCompleteTimer) return;
    const colEl = (e.target as HTMLElement).closest(
      ".freecell-cascade",
    ) as HTMLElement;
    if (!colEl) return;
    const col = parseInt(colEl.dataset.col ?? "-1");
    if (col < 0) return;

    const state = this.game.getState();
    const column = state.tableau[col];
    if (!column) return;

    const cardEl = (e.target as HTMLElement).closest(".card") as HTMLElement;
    if (cardEl) {
      const cardIdx = parseInt(cardEl.dataset.index ?? "-1");
      if (cardIdx < 0) return;

      // Double-click the selected top card to send it to a foundation.
      if (
        state.selected?.type === "tableau" &&
        state.selected.col === col &&
        state.selected.cardIndex === cardIdx &&
        cardIdx === column.length - 1
      ) {
        const idx = this.game.canAutoFoundation(column[cardIdx]!);
        if (idx >= 0) {
          this.game.selectFoundation(idx);
          this.render();
          return;
        }
      }

      this.game.selectTableau(col, cardIdx);
    } else if (state.selected !== null) {
      // Clicked the empty area of a column — drop the current selection here.
      if (state.selected.type === "free") {
        this.game.playFreeToTableau(state.selected.cell, col);
      } else {
        this.game.moveTableauToTableau(
          state.selected.col,
          state.selected.cardIndex,
          col,
        );
      }
    }

    this.render();
  }

  private render(): void {
    const state = this.game.getState();

    this.reporter.reportSolo(
      state.phase,
      state.won,
      52 - this.game.foundationCount(),
    );

    this.$("deal-number").textContent = String(state.dealNumber);
    this.$("move-count").textContent = String(state.moves);
    this.$("message").textContent = state.message;

    this.renderFreeCells();
    this.renderFoundations();
    this.renderTableau();
    this.renderButtons();
    if (state.phase === "GAME_OVER") this.onGameOver();

    if (!this.autoCompleteTimer && this.game.canAutoComplete()) {
      this.$("message").textContent = "Auto-completing…";
      this.autoCompleteTimer = setInterval(() => {
        if (!this.game.autoCompleteStep()) {
          clearInterval(this.autoCompleteTimer!);
          this.autoCompleteTimer = null;
        }
        this.render();
      }, 120);
    }
  }

  private onGameOver(): void {
    const cards = 52 - this.game.foundationCount();
    if (this.challenge) showChallengeOutcome(this.challenge, cards);
    showChallengeShare({
      game: "freecell",
      seed: this.game.getState().dealNumber,
      cardsRemaining: cards,
      by: getWalletAddress() ?? undefined,
    });
  }

  private renderFreeCells(): void {
    const state = this.game.getState();
    this.$("freecell-cells").innerHTML = state.freeCells
      .map((card, cell) => {
        const selected =
          state.selected?.type === "free" && state.selected.cell === cell;
        const inner = card
          ? renderCard(card, { selected })
          : `<div class="card-slot"></div>`;
        return `<div class="freecell-cell" data-cell="${cell}">${inner}</div>`;
      })
      .join("");
  }

  private renderFoundations(): void {
    const state = this.game.getState();
    const isTarget = state.selected !== null && state.phase === "PLAYING";
    this.$("freecell-foundations").innerHTML = state.foundations
      .map((pile, suitIdx) => {
        const symbol = SUIT_SYMBOL[FOUNDATION_SUITS[suitIdx]!];
        const cls = `freecell-foundation${isTarget ? " clickable" : ""}`;
        if (pile.length > 0) {
          return `<div class="${cls}" data-suit="${suitIdx}">${renderCard(pile[pile.length - 1]!)}</div>`;
        }
        return `<div class="${cls} empty" data-suit="${suitIdx}"><div class="card-slot"><span class="foundation-suit">${symbol}</span></div></div>`;
      })
      .join("");
  }

  private renderTableau(): void {
    const state = this.game.getState();
    this.$("freecell-tableau").innerHTML = state.tableau
      .map((column, colIdx) => {
        if (column.length === 0) {
          return `<div class="freecell-cascade" data-col="${colIdx}"><div class="card-slot freecell-empty-col"></div></div>`;
        }
        const cards = column
          .map((card, cardIdx) => {
            const selected =
              state.selected?.type === "tableau" &&
              state.selected.col === colIdx &&
              cardIdx >= state.selected.cardIndex;
            return `<div class="freecell-cascade-card">${renderCard(card, { index: cardIdx, selected })}</div>`;
          })
          .join("");
        return `<div class="freecell-cascade" data-col="${colIdx}">${cards}</div>`;
      })
      .join("");
  }

  private renderButtons(): void {
    const over = this.game.getState().phase === "GAME_OVER";
    const undo = this.$("undo-btn") as HTMLButtonElement;
    undo.disabled = !this.game.canUndo();
    for (const id of ["undo-btn", "restart-btn", "give-up-btn"]) {
      this.$(id).classList.toggle("hidden", over);
    }
    this.$("action-btn").classList.toggle("hidden", !over);
  }
}
