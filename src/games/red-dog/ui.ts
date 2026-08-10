import { RedDogGame } from "./game";
import { balance, betOptions } from "../../shared/engine/betting";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";

export class RedDogUI {
  private game: RedDogGame;

  constructor() {
    document.getElementById("app")!.innerHTML = RedDogUI.template();
    this.game = new RedDogGame();
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
          <h1>Red Dog</h1>
        </div>
        <div class="header-right">
          <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
          <button id="new-game-btn">New Game</button>
        </div>
      </div>

      <div class="scoreboard">
        <div class="score-row">
          <span class="score-label">Balance</span>
          <span class="score-value" id="balance-display"></span>
        </div>
        <div class="score-row">
          <span class="score-label">Bet</span>
          <span class="score-value" id="bet-display">—</span>
        </div>
      </div>

      <div class="reddog-table">
        <div class="reddog-cards" id="reddog-cards"></div>
        <div class="reddog-spread" id="reddog-spread"></div>
      </div>

      <div class="message-bar" id="message"></div>

      <div class="action-area">
        <div class="reddog-bet-buttons hidden" id="bet-buttons"></div>
        <div class="reddog-raise-buttons hidden" id="raise-buttons">
          <button id="raise-btn">Raise (double)</button>
          <button id="call-btn">Deal Third Card</button>
        </div>
        <button class="hidden" id="next-round-btn">New Round</button>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("red-dog"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => {
        location.hash = "/";
      }),
    );

    this.$("bet-buttons").addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(
        "[data-amount]",
      ) as HTMLElement | null;
      if (!btn) return;
      this.game.placeBet(parseInt(btn.dataset.amount ?? "0"));
      this.render();
    });

    this.$("raise-btn").addEventListener("click", () => {
      this.game.raise();
      this.render();
    });

    this.$("call-btn").addEventListener("click", () => {
      this.game.call();
      this.render();
    });

    this.$("next-round-btn").addEventListener("click", () => {
      this.game.newRound();
      this.render();
    });
  }

  private render(): void {
    const state = this.game.getState();

    this.$("balance-display").textContent = String(state.balance);
    this.$("bet-display").textContent =
      state.bet > 0 ? `${state.bet}${state.raised ? " (raised)" : ""}` : "—";

    const msg = this.$("message");
    msg.textContent = state.message;
    msg.className = `message-bar${state.outcome ? ` reddog-${state.outcome}` : ""}`;

    const cardsEl = this.$("reddog-cards");
    if (!state.card1) {
      cardsEl.innerHTML =
        renderFaceDownCard() + renderFaceDownCard() + renderFaceDownCard();
    } else {
      cardsEl.innerHTML =
        renderCard(state.card1) +
        (state.card3 ? renderCard(state.card3) : renderFaceDownCard()) +
        renderCard(state.card2!);
    }

    this.$("reddog-spread").textContent =
      state.spread !== null
        ? `Spread ${state.spread} · pays ${state.payoutRatio}:1`
        : state.payoutRatio !== null
          ? `Pair · match pays ${state.payoutRatio}:1`
          : "";

    const betBtns = this.$("bet-buttons");
    const raiseBtns = this.$("raise-buttons");
    const nextBtn = this.$("next-round-btn");
    betBtns.classList.add("hidden");
    raiseBtns.classList.add("hidden");
    nextBtn.classList.add("hidden");

    if (state.phase === "BETTING") {
      betBtns.innerHTML = betOptions(balance())
        .map(
          (n) =>
            `<button class="reddog-bet-btn" data-amount="${n}">${n}</button>`,
        )
        .join("");
      betBtns.classList.remove("hidden");
    } else if (state.phase === "RAISE") {
      (this.$("raise-btn") as HTMLButtonElement).disabled =
        !this.game.canRaise();
      raiseBtns.classList.remove("hidden");
    } else {
      nextBtn.classList.remove("hidden");
    }
  }
}
