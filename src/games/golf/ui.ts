import { GolfGame } from "./game";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";

export class GolfUI {
  private game: GolfGame;

  constructor() {
    document.getElementById("app")!.innerHTML = GolfUI.template();
    this.game = new GolfGame();
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
          <h1>Golf Solitaire</h1>
        </div>
        <button id="new-game-btn">New Game</button>
      </div>

      <div class="scoreboard">
        <div class="score-row">
          <span class="score-label">Cards Remaining</span>
          <span class="score-value" id="cards-remaining">35</span>
        </div>
      </div>

      <div class="golf-tableau" id="golf-tableau"></div>

      <div class="play-area">
        <div id="golf-waste"></div>
        <div id="golf-stock"></div>
      </div>

      <div class="message-bar" id="message"></div>

      <div class="action-area">
        <button id="action-btn" class="hidden">New Game</button>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("new-game-btn").addEventListener("click", () => this.newGame());
    this.$("action-btn").addEventListener("click", () => this.newGame());
    this.$("golf-stock").addEventListener("click", () => this.onDrawStock());
    this.$("golf-tableau").addEventListener("click", (e) => this.onTableauClick(e));
  }

  private newGame(): void {
    this.game = new GolfGame();
    this.game.deal();
    this.render();
  }

  private onDrawStock(): void {
    if (!this.game.canDrawFromStock()) return;
    this.game.drawFromStock();
    this.render();
  }

  private onTableauClick(e: Event): void {
    const target = (e.target as HTMLElement).closest(".golf-column") as HTMLElement;
    if (!target) return;
    const colIndex = parseInt(target.dataset.col || "-1");
    if (colIndex < 0) return;
    this.game.playCard(colIndex);
    this.render();
  }

  private render(): void {
    const state = this.game.getState();

    this.$("cards-remaining").textContent = String(this.game.cardsRemaining());
    this.$("message").textContent = state.message;

    this.renderTableau();
    this.renderWaste();
    this.renderStock();
    this.renderActionButton();
  }

  private renderTableau(): void {
    const state = this.game.getState();
    const container = this.$("golf-tableau");
    const isPlaying = state.phase === "PLAYING";

    container.innerHTML = state.tableau
      .map((col, colIdx) => {
        const topIdx = col.length - 1;
        const cards = col
          .map((card, rowIdx) => {
            const isTop = rowIdx === topIdx;
            const playable = isTop && isPlaying && state.waste !== null && this.game.canPlay(card, state.waste);
            return `<div class="golf-cell">${renderCard(card, {
              index: rowIdx,
              dimmed: isPlaying && !isTop,
            })}</div>`;
          })
          .join("");

        const clickable = isPlaying && col.length > 0 && state.waste !== null && this.game.canPlay(col[topIdx]!, state.waste);
        return `<div class="golf-column ${clickable ? "playable" : ""}" data-col="${colIdx}">${cards}</div>`;
      })
      .join("");
  }

  private renderWaste(): void {
    const state = this.game.getState();
    const container = this.$("golf-waste");
    if (state.waste) {
      container.innerHTML = `<div class="pile-label">Waste</div>${renderCard(state.waste)}`;
    } else {
      container.innerHTML = `<div class="pile-label">Waste</div><div class="card-slot"></div>`;
    }
  }

  private renderStock(): void {
    const state = this.game.getState();
    const container = this.$("golf-stock");
    if (state.stock.length > 0) {
      container.innerHTML = `<div class="pile-label">Stock (${state.stock.length})</div>${renderFaceDownCard()}`;
      container.style.cursor = "pointer";
    } else {
      container.innerHTML = `<div class="pile-label">Stock (0)</div><div class="card-slot"></div>`;
      container.style.cursor = "default";
    }
  }

  private renderActionButton(): void {
    const btn = this.$("action-btn") as HTMLButtonElement;
    if (this.game.getState().phase === "GAME_OVER") {
      btn.textContent = "New Game";
      btn.classList.remove("hidden");
    } else {
      btn.classList.add("hidden");
    }
  }
}
