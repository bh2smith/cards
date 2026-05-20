import { Suit } from "typedeck";
import { KlondikeGame } from "./game";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { SUIT_SYMBOL } from "../../shared/deck";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";
import { LeaderboardReporter, GameId } from "../../shared/circles/leaderboard";

const FOUNDATION_SUITS = [Suit.Clubs, Suit.Spades, Suit.Diamonds, Suit.Hearts];

export class KlondikeUI {
  private game: KlondikeGame;
  private reporter = new LeaderboardReporter(GameId.Klondike);

  constructor() {
    document.getElementById("app")!.innerHTML = KlondikeUI.template();
    this.game = new KlondikeGame();
    this.game.deal();
    this.bindEvents();
    this.render();
  }

  destroy(): void {
    document.getElementById("app")!.innerHTML = "";
  }

  static template(): string {
    return `
      <div class="header">
        <div class="header-left">
          <a href="#" class="back-link">← Games</a>
          <h1>Klondike</h1>
        </div>
        <div class="header-right">
          <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
          <button id="new-game-btn">New Game</button>
        </div>
      </div>

      <div class="scoreboard">
        <div class="score-row">
          <span class="score-label">Moves</span>
          <span class="score-value" id="move-count">0</span>
        </div>
      </div>

      <div class="klondike-top-row">
        <div class="klondike-foundations" id="klondike-foundations"></div>
        <div class="klondike-stock-waste">
          <div id="klondike-stock"></div>
          <div id="klondike-waste"></div>
        </div>
      </div>

      <div class="klondike-tableau" id="klondike-tableau"></div>

      <div class="message-bar" id="message"></div>

      <div class="action-area">
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
      openInstructions("klondike"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => this.goToLobby()),
    );
    this.$("action-btn").addEventListener("click", () => this.goToLobby());
    this.$("give-up-btn").addEventListener("click", () => {
      confirmIfEnabled("Give up this game?", () => {
        this.game.giveUp();
        this.render();
      });
    });
    this.$("klondike-stock").addEventListener("click", () =>
      this.onStockClick(),
    );
    this.$("klondike-waste").addEventListener("click", () =>
      this.onWasteClick(),
    );
    this.$("klondike-foundations").addEventListener("click", (e) =>
      this.onFoundationClick(e),
    );
    this.$("klondike-tableau").addEventListener("click", (e) =>
      this.onTableauClick(e),
    );
  }

  private onStockClick(): void {
    this.game.drawStock();
    this.render();
  }

  private onWasteClick(): void {
    const state = this.game.getState();
    if (state.waste.length === 0) return;

    // Double-click auto-foundation: if waste card can go to foundation, do it
    if (
      state.selected !== null &&
      state.selected.type === "waste"
    ) {
      const card = state.waste[state.waste.length - 1]!;
      const foundIdx = this.game.canAutoFoundation(card);
      if (foundIdx >= 0) {
        this.game.selectFoundation(foundIdx);
        this.render();
        return;
      }
    }

    this.game.selectWaste();
    this.render();
  }

  private onFoundationClick(e: Event): void {
    const target = (e.target as HTMLElement).closest(
      ".klondike-foundation",
    ) as HTMLElement;
    if (!target) return;
    const suitIndex = parseInt(target.dataset.suit || "-1");
    if (suitIndex < 0) return;
    this.game.selectFoundation(suitIndex);
    this.render();
  }

  private onTableauClick(e: Event): void {
    const target = e.target as HTMLElement;

    // Check if clicking a face-up card
    const cardEl = target.closest(".card:not(.face-down)") as HTMLElement;
    const colEl = target.closest(".klondike-cascade") as HTMLElement;
    if (!colEl) return;

    const colIndex = parseInt(colEl.dataset.col || "-1");
    if (colIndex < 0) return;

    const state = this.game.getState();
    const column = state.tableau[colIndex];
    if (!column) return;

    if (cardEl) {
      const cardIdx = parseInt(cardEl.dataset.index || "-1");
      if (cardIdx < 0) return;

      // Double-click auto-foundation: if clicking the top face-up card again while selected
      if (
        state.selected !== null &&
        state.selected.type === "tableau" &&
        state.selected.col === colIndex &&
        state.selected.cardIndex === cardIdx &&
        cardIdx === column.faceUp.length - 1
      ) {
        const card = column.faceUp[cardIdx]!;
        const foundIdx = this.game.canAutoFoundation(card);
        if (foundIdx >= 0) {
          this.game.selectFoundation(foundIdx);
          this.render();
          return;
        }
      }

      this.game.selectTableau(colIndex, cardIdx);
    } else {
      // Clicked on empty column or face-down area — try to move selection here
      if (state.selected !== null) {
        if (state.selected.type === "waste") {
          this.game.playWasteToTableau(colIndex);
        } else if (state.selected.type === "tableau") {
          this.game.moveTableauToTableau(
            state.selected.col,
            state.selected.cardIndex,
            colIndex,
          );
        }
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

    this.$("move-count").textContent = String(state.moves);
    this.$("message").textContent = state.message;

    this.renderFoundations();
    this.renderStock();
    this.renderWaste();
    this.renderTableau();
    this.renderActionButton();
  }

  private renderFoundations(): void {
    const state = this.game.getState();
    const container = this.$("klondike-foundations");

    container.innerHTML = state.foundations
      .map((pile, suitIdx) => {
        const suit = FOUNDATION_SUITS[suitIdx]!;
        const symbol = SUIT_SYMBOL[suit];
        const isTarget =
          state.selected !== null && state.phase === "PLAYING";

        if (pile.length > 0) {
          const topCard = pile[pile.length - 1]!;
          return `<div class="klondike-foundation ${isTarget ? "clickable" : ""}" data-suit="${suitIdx}">${renderCard(topCard)}</div>`;
        }

        return `<div class="klondike-foundation empty ${isTarget ? "clickable" : ""}" data-suit="${suitIdx}"><div class="card-slot"><span class="foundation-suit">${symbol}</span></div></div>`;
      })
      .join("");
  }

  private renderStock(): void {
    const state = this.game.getState();
    const container = this.$("klondike-stock");

    if (state.stock.length > 0) {
      container.innerHTML = `<div class="pile-label">Stock (${state.stock.length})</div>${renderFaceDownCard()}`;
      container.style.cursor = "pointer";
    } else if (state.waste.length > 0) {
      container.innerHTML = `<div class="pile-label">Stock</div><div class="card-slot recycle"></div>`;
      container.style.cursor = "pointer";
    } else {
      container.innerHTML = `<div class="pile-label">Stock</div><div class="card-slot"></div>`;
      container.style.cursor = "default";
    }
  }

  private renderWaste(): void {
    const state = this.game.getState();
    const container = this.$("klondike-waste");

    if (state.waste.length > 0) {
      const topCard = state.waste[state.waste.length - 1]!;
      const isSelected =
        state.selected !== null && state.selected.type === "waste";
      container.innerHTML = `<div class="pile-label">Waste (${state.waste.length})</div>${renderCard(topCard, { selected: isSelected })}`;
      container.style.cursor = "pointer";
    } else {
      container.innerHTML = `<div class="pile-label">Waste</div><div class="card-slot"></div>`;
      container.style.cursor = "default";
    }
  }

  private renderTableau(): void {
    const state = this.game.getState();
    const container = this.$("klondike-tableau");

    container.innerHTML = state.tableau
      .map((column, colIdx) => {
        const faceDownHtml = column.faceDown
          .map((_, i) => {
            return `<div class="klondike-cascade-card facedown">${renderFaceDownCard(i)}</div>`;
          })
          .join("");

        const faceUpHtml = column.faceUp
          .map((card, cardIdx) => {
            const isSelected =
              state.selected !== null &&
              state.selected.type === "tableau" &&
              state.selected.col === colIdx &&
              cardIdx >= state.selected.cardIndex;

            return `<div class="klondike-cascade-card faceup">${renderCard(card, { index: cardIdx, selected: isSelected })}</div>`;
          })
          .join("");

        const isEmpty =
          column.faceDown.length === 0 && column.faceUp.length === 0;
        const emptySlot = isEmpty
          ? `<div class="card-slot klondike-empty-col"></div>`
          : "";

        return `<div class="klondike-cascade" data-col="${colIdx}">${emptySlot}${faceDownHtml}${faceUpHtml}</div>`;
      })
      .join("");
  }

  private renderActionButton(): void {
    const btn = this.$("action-btn") as HTMLButtonElement;
    const giveUp = this.$("give-up-btn") as HTMLButtonElement;
    if (this.game.getState().phase === "GAME_OVER") {
      btn.classList.remove("hidden");
      giveUp.classList.add("hidden");
    } else {
      btn.classList.add("hidden");
      giveUp.classList.remove("hidden");
    }
  }
}
