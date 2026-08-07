import { GoFishGame } from "./game";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { RANK_DISPLAY } from "../../shared/deck";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";
import type { GoFishState } from "./types";
import type { CardName } from "typedeck";

const BOT_STEP_MS = 700;

export class GoFishUI {
  private game: GoFishGame;
  private destroyed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    document.getElementById("app")!.innerHTML = GoFishUI.template();
    this.game = new GoFishGame();
    this.bindEvents();
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    document.getElementById("app")!.innerHTML = "";
  }

  static template(): string {
    return `
      <div class="header">
        <div class="header-left">
          <a href="#" class="back-link">← Games</a>
          <h1>Go Fish</h1>
        </div>
        <div class="header-right">
          <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
          <button id="new-game-btn">New Game</button>
        </div>
      </div>

      <div class="gofish-side">
        <div class="gofish-label" id="gofish-bot-label"></div>
        <div class="hand-area gofish-bot-hand" id="gofish-bot-hand"></div>
        <div class="gofish-books" id="gofish-bot-books"></div>
      </div>

      <div class="gofish-pond" id="gofish-pond"></div>

      <div class="gofish-side">
        <div class="gofish-books" id="gofish-player-books"></div>
        <div class="gofish-label" id="gofish-player-label"></div>
        <div class="hand-area gofish-hand" id="gofish-player-hand"></div>
      </div>

      <div class="message-bar" id="message"></div>

      <div class="action-area">
        <button id="gofish-restart" class="hidden">New Game</button>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("go-fish"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Start a new game?", () => this.restart()),
    );
    this.$("gofish-restart").addEventListener("click", () => this.restart());
    this.$("gofish-player-hand").addEventListener("click", (e) =>
      this.onHandClick(e),
    );
  }

  private restart(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.game.newGame();
    this.render();
  }

  private onHandClick(e: Event): void {
    const state = this.game.getState();
    if (state.phase !== "PLAYER_TURN") return;

    const target = (e.target as HTMLElement).closest(
      ".card",
    ) as HTMLElement | null;
    if (!target) return;
    const index = parseInt(target.dataset.index ?? "-1");
    const card = state.playerHand[index];
    if (!card) return;

    if (!this.game.playerAsk(card.cardName as CardName)) return;
    this.render();
    if (this.game.getState().phase === "BOT_TURN") this.scheduleBot();
  }

  private scheduleBot(): void {
    if (this.destroyed) return;
    this.timer = setTimeout(() => {
      if (this.destroyed) return;
      if (this.game.getState().phase !== "BOT_TURN") return;
      this.game.botAsk();
      this.render();
      if (this.game.getState().phase === "BOT_TURN") this.scheduleBot();
    }, BOT_STEP_MS);
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();

    this.$("message").textContent = state.message;
    this.renderBotSide(state);
    this.renderPond(state);
    this.renderPlayerSide(state);

    this.$("gofish-restart").classList.toggle(
      "hidden",
      state.phase !== "GAME_OVER",
    );
  }

  private renderBotSide(state: GoFishState): void {
    this.$("gofish-bot-label").textContent =
      `Bot — ${state.computerHand.length} cards`;
    this.$("gofish-bot-hand").innerHTML = state.computerHand
      .map((_, i) => renderFaceDownCard(i, true))
      .join("");
    this.renderBooks(this.$("gofish-bot-books"), "Bot books", [
      ...state.computerBooks,
    ]);
  }

  private renderPond(state: GoFishState): void {
    const pile =
      state.pond.length > 0
        ? renderFaceDownCard(-1, true)
        : `<div class="card-slot"></div>`;
    this.$("gofish-pond").innerHTML =
      `${pile}<div class="pile-label">Pond (${state.pond.length})</div>`;
  }

  private renderPlayerSide(state: GoFishState): void {
    this.renderBooks(this.$("gofish-player-books"), "Your books", [
      ...state.playerBooks,
    ]);
    const myTurn = state.phase === "PLAYER_TURN";
    this.$("gofish-player-label").textContent = myTurn
      ? "Your hand — click a card to ask for its rank"
      : "Your hand";

    const container = this.$("gofish-player-hand");
    container.innerHTML = state.playerHand
      .map((card, i) => renderCard(card, { index: i, dimmed: !myTurn }))
      .join("");
    container.style.cursor = myTurn ? "pointer" : "default";
  }

  private renderBooks(el: HTMLElement, title: string, books: CardName[]): void {
    const chips = books.length
      ? books
          .map((r) => `<div class="gofish-book">${RANK_DISPLAY[r]}</div>`)
          .join("")
      : `<span class="gofish-books-empty">none yet</span>`;
    el.innerHTML = `<span class="gofish-books-title">${title} (${books.length}):</span>${chips}`;
  }
}
