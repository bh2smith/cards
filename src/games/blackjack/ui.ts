import { BlackjackGame, handValue, isBlackjack, isBust } from "./game";
import { BET_OPTIONS } from "./types";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";

const DEALER_DELAY_MS = 600;

export class BlackjackUI {
  private game: BlackjackGame;
  private destroyed = false;

  constructor() {
    document.getElementById("app")!.innerHTML = BlackjackUI.template();
    this.game = new BlackjackGame();
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
          <h1>Blackjack</h1>
        </div>
        <button id="new-game-btn">New Game</button>
      </div>

      <div class="scoreboard">
        <div class="score-row">
          <span class="score-label">Chips</span>
          <span class="score-value" id="chips-display">100</span>
        </div>
        <div class="score-row">
          <span class="score-label">Bet</span>
          <span class="score-value" id="bet-display">—</span>
        </div>
      </div>

      <div class="bj-table">
        <div class="bj-hand-section">
          <div class="bj-hand-label">Dealer <span class="bj-hand-value" id="dealer-value"></span></div>
          <div class="bj-hand" id="dealer-hand"></div>
        </div>
        <div id="player-hands"></div>
      </div>

      <div class="message-bar" id="message"></div>

      <div class="action-area" id="action-area">
        <div class="bj-bet-buttons hidden" id="bet-buttons">
          ${BET_OPTIONS.map((n) => `<button class="bj-bet-btn" data-amount="${n}">${n}</button>`).join("")}
        </div>
        <div class="bj-play-buttons hidden" id="play-buttons">
          <button id="hit-btn">Hit</button>
          <button id="stand-btn">Stand</button>
          <button id="double-btn">Double</button>
          <button id="split-btn">Split</button>
        </div>
        <button class="hidden" id="next-round-btn">Next Round</button>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("new-game-btn").addEventListener("click", () => {
      this.game = new BlackjackGame();
      this.render();
    });

    this.$("bet-buttons").addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-amount]") as HTMLElement | null;
      if (!btn) return;
      const amount = parseInt(btn.dataset.amount ?? "0");
      if (!this.game.canBet(amount)) return;
      this.game.placeBet(amount);
      this.afterPlayerAction();
    });

    this.$("hit-btn").addEventListener("click", () => {
      this.game.hit();
      this.afterPlayerAction();
    });

    this.$("stand-btn").addEventListener("click", () => {
      this.game.stand();
      this.afterPlayerAction();
    });

    this.$("double-btn").addEventListener("click", () => {
      this.game.doubleDown();
      this.afterPlayerAction();
    });

    this.$("split-btn").addEventListener("click", () => {
      this.game.split();
      this.render();
    });

    this.$("next-round-btn").addEventListener("click", () => {
      this.game.newRound();
      this.render();
    });
  }

  private afterPlayerAction(): void {
    this.render();
    const phase = this.game.getState().phase;
    if (phase === "DEALER_TURN") {
      void this.runDealerSequence();
    }
  }

  private async runDealerSequence(): Promise<void> {
    this.game.beginDealerTurn();
    this.render();

    await this.delay(DEALER_DELAY_MS);
    if (this.destroyed) return;

    while (true) {
      const drew = this.game.dealerDrawOne();
      this.render();
      if (!drew) break;
      await this.delay(DEALER_DELAY_MS);
      if (this.destroyed) return;
    }

    this.game.settleRound();
    this.render();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private render(): void {
    const state = this.game.getState();

    this.$("chips-display").textContent = String(state.chips);
    const betText =
      state.bet > 0
        ? state.splitHand !== null
          ? `${state.bet} + ${state.splitBet}`
          : String(state.bet)
        : "—";
    this.$("bet-display").textContent = betText;
    this.$("message").textContent = state.message;

    this.renderDealerHand();
    this.renderPlayerHands();
    this.renderControls();
  }

  private renderDealerHand(): void {
    const state = this.game.getState();
    const dealerEl = this.$("dealer-hand");
    const dealerValEl = this.$("dealer-value");

    if (state.dealerHand.length === 0) {
      dealerEl.innerHTML = "";
      dealerValEl.textContent = "";
      return;
    }

    if (!state.holeRevealed && state.dealerHand.length >= 2) {
      dealerEl.innerHTML = renderCard(state.dealerHand[0]!) + renderFaceDownCard();
      dealerValEl.textContent = `${handValue([state.dealerHand[0]!])}+?`;
      dealerValEl.className = "bj-hand-value";
    } else {
      dealerEl.innerHTML = state.dealerHand.map((c) => renderCard(c)).join("");
      const val = handValue(state.dealerHand);
      const bust = isBust(state.dealerHand);
      dealerValEl.textContent = bust ? `${val} (bust)` : String(val);
      dealerValEl.className = `bj-hand-value${bust ? " bj-bust" : ""}`;
    }
  }

  private renderPlayerHands(): void {
    const state = this.game.getState();
    const container = this.$("player-hands");

    const renderHandSection = (
      cards: typeof state.playerHand,
      label: string,
      active: boolean,
      result: typeof state.roundResult,
    ): string => {
      const val = cards.length > 0 ? handValue(cards) : 0;
      const bust = cards.length > 0 && isBust(cards);
      const bj = isBlackjack(cards);
      const valText = cards.length === 0 ? "" : bj ? "BJ" : bust ? `${val} (bust)` : String(val);
      const valClass = bust ? "bj-bust" : bj ? "bj-bj" : "";
      const sectionClass = state.splitHand !== null && !active && state.phase === "PLAYER_TURN"
        ? "bj-hand-section bj-inactive"
        : "bj-hand-section";

      return `<div class="${sectionClass}">
        <div class="bj-hand-label">${label} <span class="bj-hand-value ${valClass}">${valText}</span></div>
        <div class="bj-hand">${cards.map((c) => renderCard(c)).join("")}</div>
      </div>`;
    };

    if (state.splitHand !== null) {
      container.innerHTML =
        renderHandSection(state.playerHand, "Hand 1", state.activeHand === 0, state.roundResult) +
        renderHandSection(state.splitHand, "Hand 2", state.activeHand === 1, state.splitResult);
    } else {
      container.innerHTML = renderHandSection(state.playerHand, "You", true, state.roundResult);
    }
  }

  private renderControls(): void {
    const state = this.game.getState();
    const betBtns = this.$("bet-buttons");
    const playBtns = this.$("play-buttons");
    const nextBtn = this.$("next-round-btn") as HTMLButtonElement;

    betBtns.classList.add("hidden");
    playBtns.classList.add("hidden");
    nextBtn.classList.add("hidden");

    if (state.phase === "BETTING") {
      betBtns.classList.remove("hidden");
      betBtns.querySelectorAll<HTMLButtonElement>(".bj-bet-btn").forEach((btn) => {
        btn.disabled = parseInt(btn.dataset.amount ?? "0") > state.chips;
      });
    } else if (state.phase === "PLAYER_TURN") {
      const activeCards =
        state.activeHand === 1 && state.splitHand !== null
          ? state.splitHand
          : state.playerHand;
      if (!isBlackjack(activeCards)) {
        playBtns.classList.remove("hidden");
        (this.$("double-btn") as HTMLButtonElement).disabled = !this.game.canDoubleDown();
        (this.$("split-btn") as HTMLButtonElement).disabled = !this.game.canSplit();
      }
    } else if (state.phase === "ROUND_OVER") {
      nextBtn.classList.remove("hidden");
      nextBtn.textContent = state.chips === 0 ? "New Game (out of chips)" : "Next Round";
    }
  }
}
