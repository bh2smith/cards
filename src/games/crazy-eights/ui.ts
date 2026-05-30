import { Suit, type PlayingCard } from "typedeck";
import { CrazyEightsGame } from "./game";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { SUIT_SYMBOL } from "../../shared/deck";
import type { CrazyEightsState } from "./types";
import { WINNING_SCORE } from "./types";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";
import { LeaderboardReporter, GameId } from "../../shared/circles/leaderboard";

const SUIT_ORDER: Suit[] = [
  Suit.Clubs,
  Suit.Diamonds,
  Suit.Hearts,
  Suit.Spades,
];

const RED_SUITS = new Set<Suit>([Suit.Diamonds, Suit.Hearts]);

export class CrazyEightsUI {
  private game: CrazyEightsGame;
  private destroyed = false;
  private animating = false;
  private reporter = new LeaderboardReporter(GameId.CrazyEights);

  constructor() {
    document.getElementById("app")!.innerHTML = CrazyEightsUI.template();
    this.game = new CrazyEightsGame();
    this.bindEvents();
    this.render();
    if (this.game.getState().phase === "BOT_TURN") this.scheduleBotTurn();
  }

  destroy(): void {
    this.destroyed = true;
    document.getElementById("app")!.innerHTML = "";
  }

  static template(): string {
    return `
      <div class="header">
        <div class="header-left">
          <a href="#" class="back-link">← Games</a>
          <h1>Crazy Eights</h1>
        </div>
        <div class="header-right">
          <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
          <button id="new-game-btn">New Game</button>
        </div>
      </div>

      <div class="scoreboard">
        <div class="score-row">
          <span class="score-label">You</span>
          <span class="score-value" id="player-score">0</span>
        </div>
        <div class="board-track"><div class="board-peg" id="player-peg" style="width:0%"></div></div>
        <div class="score-row">
          <span class="score-label">Computer</span>
          <span class="score-value" id="computer-score">0</span>
        </div>
        <div class="board-track"><div class="board-peg" id="computer-peg" style="width:0%"></div></div>
      </div>

      <div class="hand-area ce-bot-hand" id="computer-hand"></div>

      <div class="play-area ce-play-area">
        <div id="ce-stock"></div>
        <div id="ce-discard"></div>
        <div class="ce-suit-badge" id="ce-suit-badge"></div>
      </div>

      <div class="hand-area" id="player-hand"></div>

      <div class="message-bar" id="message"></div>

      <div class="action-area">
        <div class="ce-action-buttons">
          <button id="draw-btn" class="hidden">Draw</button>
          <button id="action-btn" class="hidden">Next Round</button>
        </div>
      </div>

      <div id="ce-suit-picker" class="ce-suit-picker hidden"></div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("crazy-eights"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => {
        location.hash = "/";
      }),
    );
    this.$("draw-btn").addEventListener("click", () => this.onDraw());
    this.$("ce-stock").addEventListener("click", () => this.onDraw());
    this.$("action-btn").addEventListener("click", () => this.onAction());
    this.$("player-hand").addEventListener("click", (e) => this.onHandClick(e));
    this.$("ce-suit-picker").addEventListener("click", (e) =>
      this.onSuitPick(e),
    );
  }

  private onHandClick(e: Event): void {
    if (this.animating) return;
    const state = this.game.getState();
    if (state.phase !== "PLAYER_TURN" || state.currentTurn !== "player") return;

    const target = (e.target as HTMLElement).closest(".card") as HTMLElement;
    if (!target) return;
    const index = parseInt(target.dataset.index ?? "-1");
    if (index < 0) return;

    if (!this.game.playerPlay(index)) return;
    this.render();
    if (this.game.getState().phase === "BOT_TURN") this.scheduleBotTurn();
  }

  private onDraw(): void {
    if (this.animating) return;
    if (!this.game.canPlayerDraw()) return;
    this.game.playerDraw();
    this.render();
    if (this.game.getState().phase === "BOT_TURN") this.scheduleBotTurn();
  }

  private onSuitPick(e: Event): void {
    const btn = (e.target as HTMLElement).closest(
      ".ce-suit-option",
    ) as HTMLElement;
    if (!btn) return;
    const suit = parseInt(btn.dataset.suit ?? "-1") as Suit;
    this.game.playerChooseSuit(suit);
    this.render();
    if (this.game.getState().phase === "BOT_TURN") this.scheduleBotTurn();
  }

  private onAction(): void {
    if (this.animating) return;
    const state = this.game.getState();
    if (state.phase === "ROUND_OVER") {
      this.game.nextRound();
      this.render();
      if (this.game.getState().phase === "BOT_TURN") this.scheduleBotTurn();
    } else if (state.phase === "GAME_OVER") {
      location.hash = "/";
    }
  }

  private async scheduleBotTurn(): Promise<void> {
    if (this.destroyed) return;
    this.animating = true;
    await this.delay(700);
    if (this.destroyed) return;
    this.game.botTurn();
    this.animating = false;
    this.render();
    if (this.game.getState().phase === "BOT_TURN") this.scheduleBotTurn();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();

    this.reporter.reportVsAi(state.phase, state.winner === "player");

    this.$("player-score").textContent = String(state.playerScore);
    this.$("computer-score").textContent = String(state.computerScore);
    this.$("player-peg").style.width =
      `${Math.min(100, (state.playerScore / WINNING_SCORE) * 100)}%`;
    this.$("computer-peg").style.width =
      `${Math.min(100, (state.computerScore / WINNING_SCORE) * 100)}%`;
    this.$("message").textContent = state.message;

    this.renderComputerHand(state);
    this.renderPlayerHand(state);
    this.renderPlayArea(state);
    this.renderSuitPicker(state);
    this.renderButtons(state);
  }

  private renderComputerHand(state: CrazyEightsState): void {
    const container = this.$("computer-hand");
    const reveal = state.phase === "ROUND_OVER" || state.phase === "GAME_OVER";
    if (reveal) {
      container.innerHTML = state.computerHand
        .map((c) => renderCard(c, { small: true }))
        .join("");
    } else {
      container.innerHTML = state.computerHand
        .map((_, i) => renderFaceDownCard(i, true))
        .join("");
    }
  }

  private renderPlayerHand(state: CrazyEightsState): void {
    const container = this.$("player-hand");
    const myTurn =
      state.phase === "PLAYER_TURN" && state.currentTurn === "player";
    const legal = new Set(myTurn ? this.game.legalPlays(state.playerHand) : []);

    container.innerHTML = state.playerHand
      .map((c, i) => {
        const playable = legal.has(i);
        const html = renderCard(c, {
          index: i,
          dimmed: myTurn && !playable,
        });
        return playable
          ? html.replace('class="card ', 'class="card ce-playable ')
          : html;
      })
      .join("");
    container.style.cursor = myTurn ? "pointer" : "default";
  }

  private renderPlayArea(state: CrazyEightsState): void {
    const stockEl = this.$("ce-stock");
    const discardEl = this.$("ce-discard");
    const canDraw = this.game.canPlayerDraw();

    stockEl.innerHTML =
      state.stock.length > 0
        ? `<div class="pile-label">Stock (${state.stock.length})</div>${renderFaceDownCard()}`
        : `<div class="pile-label">Stock (0)</div><div class="card-slot"></div>`;
    stockEl.style.cursor =
      canDraw && state.stock.length > 0 ? "pointer" : "default";

    const top = this.game.topCard();
    discardEl.innerHTML = `<div class="pile-label">Discard</div>${renderCard(top)}`;

    const badge = this.$("ce-suit-badge");
    const red = RED_SUITS.has(state.activeSuit);
    badge.innerHTML = `<span class="ce-suit-symbol ${red ? "red" : "black"}">${SUIT_SYMBOL[state.activeSuit]}</span><span class="ce-suit-caption">in play</span>`;
  }

  private renderSuitPicker(state: CrazyEightsState): void {
    const picker = this.$("ce-suit-picker");
    if (state.phase !== "CHOOSE_SUIT") {
      picker.classList.add("hidden");
      picker.innerHTML = "";
      return;
    }
    picker.classList.remove("hidden");
    picker.innerHTML = `
      <div class="ce-suit-picker-title">Choose a suit</div>
      <div class="ce-suit-options">
        ${SUIT_ORDER.map((suit) => {
          const red = RED_SUITS.has(suit);
          return `<button class="ce-suit-option ${red ? "red" : "black"}" data-suit="${suit}" type="button">${SUIT_SYMBOL[suit]}</button>`;
        }).join("")}
      </div>
    `;
  }

  private renderButtons(state: CrazyEightsState): void {
    const drawBtn = this.$("draw-btn") as HTMLButtonElement;
    const actionBtn = this.$("action-btn") as HTMLButtonElement;

    if (this.game.canPlayerDraw()) {
      drawBtn.textContent = state.stock.length === 0 ? "Pass" : "Draw";
      drawBtn.classList.remove("hidden");
    } else {
      drawBtn.classList.add("hidden");
    }

    if (state.phase === "ROUND_OVER") {
      actionBtn.textContent = "Next Round";
      actionBtn.classList.remove("hidden");
    } else if (state.phase === "GAME_OVER") {
      actionBtn.textContent = "Back to Game Room";
      actionBtn.classList.remove("hidden");
    } else {
      actionBtn.classList.add("hidden");
    }
  }
}
