import { OldMaidGame } from "./game";
import type { OldMaidState } from "./types";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";

export class OldMaidUI {
  private game: OldMaidGame;
  private destroyed = false;
  private botTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    document.getElementById("app")!.innerHTML = OldMaidUI.template();
    this.game = new OldMaidGame();
    this.bindEvents();
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.botTimer !== null) clearTimeout(this.botTimer);
    document.getElementById("app")!.innerHTML = "";
  }

  static template(): string {
    return `
      <div class="header">
        <div class="header-left">
          <a href="#" class="back-link">← Games</a>
          <h1>Old Maid</h1>
        </div>
        <div class="header-right">
          <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
          <button id="new-game-btn">New Game</button>
        </div>
      </div>

      <div class="oldmaid-side">
        <div class="oldmaid-pile" id="bot-pile"></div>
        <div class="oldmaid-hand oldmaid-bot-hand" id="bot-hand"></div>
      </div>

      <div class="message-bar" id="message"></div>

      <div class="oldmaid-side">
        <div class="oldmaid-pile" id="player-pile"></div>
        <div class="oldmaid-hand" id="player-hand"></div>
      </div>

      <div class="action-area">
        <button id="action-btn" class="hidden">New Game</button>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("old-maid"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => {
        location.hash = "/";
      }),
    );
    this.$("action-btn").addEventListener("click", () => this.newGame());
    this.$("bot-hand").addEventListener("click", (e) => this.onBotHandClick(e));
  }

  private newGame(): void {
    if (this.botTimer !== null) clearTimeout(this.botTimer);
    this.game = new OldMaidGame();
    this.render();
  }

  private onBotHandClick(e: Event): void {
    if (this.game.getState().phase !== "PLAYER_DRAW") return;
    const target = (e.target as HTMLElement).closest(".card") as HTMLElement;
    if (!target) return;
    const index = parseInt(target.dataset.index ?? "-1");
    if (index < 0) return;

    if (!this.game.playerDraw(index)) return;
    this.render();
    this.scheduleBotTurn();
  }

  private scheduleBotTurn(): void {
    if (this.game.getState().phase !== "BOT_DRAW") return;
    this.botTimer = setTimeout(() => {
      if (this.destroyed) return;
      this.game.botDraw();
      this.render();
    }, 700);
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();

    this.$("message").textContent = state.message;
    this.renderPile("bot-pile", "Computer's pairs", state.botPairs);
    this.renderPile("player-pile", "Your pairs", state.playerPairs);
    this.renderBotHand(state);
    this.renderPlayerHand(state);

    const actionBtn = this.$("action-btn");
    actionBtn.classList.toggle("hidden", state.phase !== "GAME_OVER");
  }

  private renderPile(id: string, label: string, count: number): void {
    this.$(id).innerHTML = `
      <div class="pile-label">${label}</div>
      ${count > 0 ? renderFaceDownCard(-1, true) : '<div class="card-slot"></div>'}
      <div class="oldmaid-pile-count">${count}</div>
    `;
  }

  private renderBotHand(state: OldMaidState): void {
    const container = this.$("bot-hand");
    const drawable = state.phase === "PLAYER_DRAW";

    if (state.phase === "GAME_OVER" && state.winner === "player") {
      container.innerHTML = renderCard(state.oddCard!);
      return;
    }
    container.innerHTML = state.botDrawableIndices
      .map((i) => {
        const html = renderFaceDownCard(i);
        return drawable
          ? html.replace('class="card ', 'class="card oldmaid-drawable ')
          : html;
      })
      .join("");
    container.style.cursor = drawable ? "pointer" : "default";
  }

  private renderPlayerHand(state: OldMaidState): void {
    this.$("player-hand").innerHTML = state.playerHand
      .map((card, i) => renderCard(card, { index: i }))
      .join("");
  }
}
