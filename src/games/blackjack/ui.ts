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
        <div class="bj-hand-section">
          <div class="bj-hand-label">You <span class="bj-hand-value" id="player-value"></span></div>
          <div class="bj-hand" id="player-hand"></div>
        </div>
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
      const btn = (e.target as HTMLElement).closest(
        "[data-amount]",
      ) as HTMLElement | null;
      if (!btn) return;
      const amount = parseInt(btn.dataset.amount ?? "0");
      if (!this.game.canBet(amount)) return;
      this.game.placeBet(amount);
      this.render();
      if (isBlackjack(this.game.getState().playerHand)) {
        void this.runDealerSequence();
      }
    });

    this.$("hit-btn").addEventListener("click", () => {
      this.game.hit();
      this.render();
    });

    this.$("stand-btn").addEventListener("click", () => {
      void this.runDealerSequence();
    });

    this.$("double-btn").addEventListener("click", () => {
      this.game.doubleDown();
      this.render();
      if (this.game.getState().phase === "PLAYER_TURN") {
        void this.runDealerSequence();
      }
    });

    this.$("next-round-btn").addEventListener("click", () => {
      this.game.newRound();
      this.render();
    });
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
    this.$("bet-display").textContent = state.bet > 0 ? String(state.bet) : "—";
    this.$("message").textContent = state.message;

    this.renderHands();
    this.renderControls();
  }

  private renderHands(): void {
    const state = this.game.getState();

    // Player hand
    const playerEl = this.$("player-hand");
    playerEl.innerHTML = state.playerHand
      .map((c) => renderCard(c))
      .join("");

    const playerValEl = this.$("player-value");
    if (state.playerHand.length > 0) {
      const val = handValue(state.playerHand);
      const bust = isBust(state.playerHand);
      const bj = isBlackjack(state.playerHand);
      playerValEl.textContent = bj ? "BJ" : bust ? `${val} (bust)` : String(val);
      playerValEl.className = `bj-hand-value${bust ? " bj-bust" : bj ? " bj-bj" : ""}`;
    } else {
      playerValEl.textContent = "";
    }

    // Dealer hand
    const dealerEl = this.$("dealer-hand");
    const dealerValEl = this.$("dealer-value");

    if (state.dealerHand.length === 0) {
      dealerEl.innerHTML = "";
      dealerValEl.textContent = "";
      return;
    }

    if (!state.holeRevealed && state.dealerHand.length >= 2) {
      // Show first card, hide hole card
      dealerEl.innerHTML =
        renderCard(state.dealerHand[0]!) + renderFaceDownCard();
      const visibleVal = handValue([state.dealerHand[0]!]);
      dealerValEl.textContent = `${visibleVal}+?`;
      dealerValEl.className = "bj-hand-value";
    } else {
      dealerEl.innerHTML = state.dealerHand.map((c) => renderCard(c)).join("");
      const val = handValue(state.dealerHand);
      const bust = isBust(state.dealerHand);
      dealerValEl.textContent = bust ? `${val} (bust)` : String(val);
      dealerValEl.className = `bj-hand-value${bust ? " bj-bust" : ""}`;
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
      // Disable bet buttons we can't afford
      betBtns
        .querySelectorAll<HTMLButtonElement>(".bj-bet-btn")
        .forEach((btn) => {
          const amount = parseInt(btn.dataset.amount ?? "0");
          btn.disabled = amount > state.chips;
        });
    } else if (state.phase === "PLAYER_TURN") {
      if (!isBlackjack(state.playerHand)) {
        playBtns.classList.remove("hidden");
        (this.$("double-btn") as HTMLButtonElement).disabled =
          !this.game.canDoubleDown();
      }
    } else if (state.phase === "ROUND_OVER") {
      nextBtn.classList.remove("hidden");
      nextBtn.textContent =
        state.chips === 0 ? "New Game (out of chips)" : "Next Round";
    }
  }
}
