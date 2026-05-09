import { PyramidGame } from "./game";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { confirmIfEnabled } from "../../shared/settings";

export class PyramidUI {
  private game: PyramidGame;

  constructor() {
    document.getElementById("app")!.innerHTML = PyramidUI.template();
    this.game = new PyramidGame();
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
          <h1>Pyramid</h1>
        </div>
        <button id="new-game-btn">New Game</button>
      </div>

      <div class="scoreboard">
        <div class="score-row">
          <span class="score-label">Cards Remaining</span>
          <span class="score-value" id="cards-remaining">28</span>
        </div>
      </div>

      <div class="pyramid-tableau" id="pyramid-tableau"></div>

      <div class="play-area">
        <div id="pyramid-waste"></div>
        <div id="pyramid-stock"></div>
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

  private goToLobby(): void {
    location.hash = "/";
  }

  private bindEvents(): void {
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => this.goToLobby()),
    );
    this.$("action-btn").addEventListener("click", () => this.goToLobby());
    this.$("pyramid-stock").addEventListener("click", () => this.onDrawStock());
    this.$("pyramid-waste").addEventListener("click", () =>
      this.onWasteClick(),
    );
    this.$("pyramid-tableau").addEventListener("click", (e) =>
      this.onPyramidClick(e),
    );
  }

  private onDrawStock(): void {
    this.game.drawStock();
    this.render();
  }

  private onWasteClick(): void {
    this.game.selectWaste();
    this.render();
  }

  private onPyramidClick(e: Event): void {
    const target = (e.target as HTMLElement).closest(
      ".pyramid-card",
    ) as HTMLElement;
    if (!target) return;
    const row = parseInt(target.dataset.row || "-1");
    const col = parseInt(target.dataset.col || "-1");
    if (row < 0 || col < 0) return;
    this.game.selectCard(row, col);
    this.render();
  }

  private render(): void {
    const state = this.game.getState();

    this.$("cards-remaining").textContent = String(
      this.game.pyramidCardsRemaining(),
    );
    this.$("message").textContent = state.message;

    this.renderPyramid();
    this.renderWaste();
    this.renderStock();
    this.renderActionButton();
  }

  private renderPyramid(): void {
    const state = this.game.getState();
    const container = this.$("pyramid-tableau");

    container.innerHTML = state.pyramid
      .map((row, rowIdx) => {
        const cards = row
          .map((card, colIdx) => {
            if (card === null) {
              return `<div class="pyramid-card removed" data-row="${rowIdx}" data-col="${colIdx}"></div>`;
            }

            const exposed = this.game.isExposed(rowIdx, colIdx);
            const isSelected =
              Array.isArray(state.selected) &&
              state.selected[0] === rowIdx &&
              state.selected[1] === colIdx;

            return `<div class="pyramid-card ${exposed ? "exposed" : "covered"}" data-row="${rowIdx}" data-col="${colIdx}">${renderCard(card, { selected: isSelected, dimmed: !exposed })}</div>`;
          })
          .join("");

        return `<div class="pyramid-row">${cards}</div>`;
      })
      .join("");
  }

  private renderWaste(): void {
    const state = this.game.getState();
    const container = this.$("pyramid-waste");
    const wasteTop =
      state.waste.length > 0 ? state.waste[state.waste.length - 1]! : null;

    if (wasteTop) {
      const isSelected = state.selected === "waste";
      container.innerHTML = `<div class="pile-label">Waste (${state.waste.length})</div>${renderCard(wasteTop, { selected: isSelected })}`;
      container.style.cursor = "pointer";
    } else {
      container.innerHTML = `<div class="pile-label">Waste</div><div class="card-slot"></div>`;
      container.style.cursor = "default";
    }
  }

  private renderStock(): void {
    const state = this.game.getState();
    const container = this.$("pyramid-stock");

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
      btn.textContent = "Back to Game Room";
      btn.classList.remove("hidden");
    } else {
      btn.classList.add("hidden");
    }
  }
}
