import { GinRummyGame } from "./game";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { RANK_DISPLAY, SUIT_SYMBOL, cardKey } from "../../shared/deck";
import { findBestMelds } from "./melds";
import type { GinState, KnockResult, Meld } from "./types";
import { confirmIfEnabled } from "../../shared/settings";
import { isInMiniapp } from "../../shared/circles/miniapp";
import { submitVsAiResult, GameId } from "../../shared/circles/leaderboard";

export class GinRummyUI {
  private game: GinRummyGame;
  private destroyed = false;
  private animating = false;
  private resultSubmitted = false;

  constructor() {
    document.getElementById("app")!.innerHTML = GinRummyUI.template();
    this.game = new GinRummyGame();
    this.bindEvents();
    this.render();
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
          <h1>Gin Rummy</h1>
        </div>
        <button id="new-game-btn">New Game</button>
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

      <div class="hand-area" id="computer-hand"></div>

      <div class="play-area">
        <div id="gin-stock"></div>
        <div id="gin-discard"></div>
      </div>

      <div class="hand-area" id="player-hand"></div>

      <div id="knock-display" class="hidden"></div>

      <div class="message-bar" id="message"></div>

      <div class="action-area">
        <div class="gin-action-buttons">
          <button id="action-btn" class="hidden">Next Round</button>
          <button id="knock-btn" class="hidden">Knock</button>
        </div>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => {
        location.hash = "/";
      }),
    );
    this.$("action-btn").addEventListener("click", () => this.onAction());
    this.$("knock-btn").addEventListener("click", () => this.onKnock());
    this.$("gin-stock").addEventListener("click", () => this.onDrawStock());
    this.$("gin-discard").addEventListener("click", () => this.onDrawDiscard());
    this.$("player-hand").addEventListener("click", (e) => this.onHandClick(e));
  }

  private onDrawStock(): void {
    if (this.animating) return;
    this.game.playerDrawFromStock();
    this.render();
  }

  private onDrawDiscard(): void {
    if (this.animating) return;
    this.game.playerDrawFromDiscard();
    this.render();
  }

  private selectedForKnock = false;

  private onHandClick(e: Event): void {
    if (this.animating) return;
    const state = this.game.getState();
    if (state.phase !== "DISCARDING" || state.currentTurn !== "player") return;

    const target = (e.target as HTMLElement).closest(".card") as HTMLElement;
    if (!target) return;
    const index = parseInt(target.dataset.index || "-1");
    if (index < 0) return;

    if (this.selectedForKnock) {
      const knocked = this.game.playerKnock(index);
      this.selectedForKnock = false;
      if (knocked) {
        this.render();
        return;
      }
    }

    this.game.playerDiscard(index);
    this.render();
    this.scheduleBotTurn();
  }

  private onKnock(): void {
    if (this.animating) return;
    const state = this.game.getState();
    if (state.phase !== "DISCARDING" || state.currentTurn !== "player") return;
    this.selectedForKnock = true;
    this.$("message").textContent = "Select a card to discard and knock.";
  }

  private onAction(): void {
    if (this.animating) return;
    const state = this.game.getState();
    if (state.phase === "ROUND_OVER") {
      this.game.nextRound();
      this.render();
      if (this.game.getState().currentTurn === "computer") {
        this.scheduleBotTurn();
      }
    } else if (state.phase === "GAME_OVER") {
      location.hash = "/";
    }
  }

  private async scheduleBotTurn(): Promise<void> {
    if (this.destroyed) return;
    this.animating = true;
    await this.delay(600);
    if (this.destroyed) return;
    this.game.botTurn();
    this.animating = false;
    this.render();
    if (this.game.getState().phase === "BOT_TURN") {
      this.scheduleBotTurn();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();

    if (state.phase === "GAME_OVER" && !this.resultSubmitted) {
      this.resultSubmitted = true;
      if (isInMiniapp()) {
        submitVsAiResult(GameId.GinRummy, state.winner === "player").catch(
          () => {},
        );
      }
    }

    this.$("player-score").textContent = String(state.playerScore);
    this.$("computer-score").textContent = String(state.computerScore);
    this.$("player-peg").style.width = `${Math.min(100, state.playerScore)}%`;
    this.$("computer-peg").style.width =
      `${Math.min(100, state.computerScore)}%`;
    this.$("message").textContent = state.message;

    this.renderComputerHand(state);
    this.renderPlayerHand(state);
    this.renderPlayArea(state);
    this.renderKnockDisplay(state);
    this.renderButtons(state);
  }

  private groupedHandHtml(
    hand: readonly PlayingCard[],
    opts: { small?: boolean; dimmed?: boolean } = {},
  ): string {
    const { melds, deadwood } = findBestMelds([...hand]);
    const meldKeys = new Set<string>();
    const parts: string[] = [];

    for (const meld of melds) {
      for (const c of meld.cards) {
        const key = cardKey(c);
        const idx = hand.findIndex(
          (h, i) => cardKey(h) === key && !meldKeys.has(`${i}`),
        );
        meldKeys.add(`${idx}`);
        parts.push(renderCard(c, { index: idx, ...opts }));
      }
      parts.push('<div class="gin-meld-gap"></div>');
    }

    if (parts.length > 0 && deadwood.length > 0) {
      parts[parts.length - 1] = '<div class="gin-deadwood-gap"></div>';
    } else if (parts.length > 0) {
      parts.pop();
    }

    for (const c of deadwood) {
      const key = cardKey(c);
      const idx = hand.findIndex(
        (h, i) => cardKey(h) === key && !meldKeys.has(`${i}`),
      );
      meldKeys.add(`${idx}`);
      parts.push(renderCard(c, { index: idx, ...opts }));
    }

    return parts.join("");
  }

  private renderComputerHand(state: GinState): void {
    const container = this.$("computer-hand");
    const reveal = state.phase === "ROUND_OVER" || state.phase === "GAME_OVER";

    if (reveal) {
      container.innerHTML = this.groupedHandHtml(state.computerHand, {
        small: true,
      });
    } else {
      container.innerHTML = state.computerHand
        .map((_, i) => renderFaceDownCard(i, true))
        .join("");
    }
  }

  private renderPlayerHand(state: GinState): void {
    const container = this.$("player-hand");
    const clickable =
      state.phase === "DISCARDING" && state.currentTurn === "player";

    container.innerHTML = this.groupedHandHtml(state.playerHand, {
      dimmed: !clickable && state.phase === "DRAWING",
    });

    if (clickable) container.style.cursor = "pointer";
    else container.style.cursor = "default";
  }

  private renderPlayArea(state: GinState): void {
    const stockEl = this.$("gin-stock");
    const discardEl = this.$("gin-discard");
    const isDrawing =
      state.phase === "DRAWING" && state.currentTurn === "player";

    if (state.stock.length > 0) {
      stockEl.innerHTML = `<div class="pile-label">Stock (${state.stock.length})</div>${renderFaceDownCard()}`;
      stockEl.style.cursor = isDrawing ? "pointer" : "default";
    } else {
      stockEl.innerHTML = `<div class="pile-label">Stock (0)</div><div class="card-slot"></div>`;
      stockEl.style.cursor = "default";
    }

    const top = state.discardPile[state.discardPile.length - 1];
    if (top) {
      discardEl.innerHTML = `<div class="pile-label">Discard (${state.discardPile.length})</div>${renderCard(top)}`;
      discardEl.style.cursor = isDrawing ? "pointer" : "default";
    } else {
      discardEl.innerHTML = `<div class="pile-label">Discard</div><div class="card-slot"></div>`;
      discardEl.style.cursor = "default";
    }
  }

  private renderKnockDisplay(state: GinState): void {
    const container = this.$("knock-display");
    if (!state.knockResult) {
      container.classList.add("hidden");
      container.innerHTML = "";
      return;
    }

    container.classList.remove("hidden");
    const kr = state.knockResult;

    container.innerHTML = `
      <div class="gin-knock-summary">
        <div class="gin-knock-section">
          <h3>${kr.knocker === "player" ? "You" : "Computer"} (Knocker)</h3>
          ${this.renderMelds(kr.knockerMelds)}
          <div class="gin-deadwood-label">Deadwood: ${kr.knockerDeadwoodValue}</div>
        </div>
        <div class="gin-knock-section">
          <h3>${kr.knocker === "player" ? "Computer" : "You"} (Defender)</h3>
          ${this.renderMelds(kr.defenderMelds)}
          <div class="gin-deadwood-label">Deadwood: ${kr.defenderDeadwoodValue}</div>
        </div>
      </div>
    `;
  }

  private renderMelds(melds: Meld[]): string {
    if (melds.length === 0)
      return `<div class="gin-meld-group"><em>No melds</em></div>`;
    return melds
      .map((m) => {
        const label =
          m.type === "set"
            ? `Set of ${RANK_DISPLAY[m.cards[0]!.cardName]}s`
            : `Run in ${SUIT_SYMBOL[m.cards[0]!.suit]}`;
        return `<div class="gin-meld-group">
          <div class="gin-meld-label">${label}</div>
          <div class="gin-meld-cards">${m.cards.map((c) => renderCard(c, { small: true })).join("")}</div>
        </div>`;
      })
      .join("");
  }

  private renderButtons(state: GinState): void {
    const actionBtn = this.$("action-btn") as HTMLButtonElement;
    const knockBtn = this.$("knock-btn") as HTMLButtonElement;

    if (state.phase === "ROUND_OVER") {
      actionBtn.textContent = "Next Round";
      actionBtn.classList.remove("hidden");
    } else if (state.phase === "GAME_OVER") {
      actionBtn.textContent = "Back to Game Room";
      actionBtn.classList.remove("hidden");
    } else {
      actionBtn.classList.add("hidden");
    }

    if (
      state.phase === "DISCARDING" &&
      state.currentTurn === "player" &&
      this.game.canPlayerKnock()
    ) {
      knockBtn.classList.remove("hidden");
    } else {
      knockBtn.classList.add("hidden");
      this.selectedForKnock = false;
    }
  }
}
