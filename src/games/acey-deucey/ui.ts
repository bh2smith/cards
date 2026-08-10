import { AceyDeuceyGame, valueLabel } from "./game";
import { balance, betOptions } from "../../shared/engine/betting";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";

export class AceyDeuceyUI {
  private game: AceyDeuceyGame;

  constructor() {
    document.getElementById("app")!.innerHTML = AceyDeuceyUI.template();
    this.game = new AceyDeuceyGame();
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
          <h1>Acey-Deucey</h1>
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

      <div class="acey-table">
        <div class="acey-cards" id="acey-cards"></div>
        <div class="acey-bracket" id="acey-bracket"></div>
      </div>

      <div class="message-bar" id="message"></div>

      <div class="action-area">
        <button class="hidden" id="deal-btn">Deal</button>
        <div class="acey-call-buttons hidden" id="call-buttons">
          <button id="call-high-btn">Ace High</button>
          <button id="call-low-btn">Ace Low</button>
        </div>
        <div class="acey-bet-buttons hidden" id="bet-buttons"></div>
        <button class="hidden" id="next-round-btn">New Round</button>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("acey-deucey"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => {
        location.hash = "/";
      }),
    );

    this.$("deal-btn").addEventListener("click", () => {
      this.game.deal();
      this.render();
    });

    this.$("call-high-btn").addEventListener("click", () => {
      this.game.callAce("high");
      this.render();
    });

    this.$("call-low-btn").addEventListener("click", () => {
      this.game.callAce("low");
      this.render();
    });

    this.$("bet-buttons").addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(
        "[data-amount]",
      ) as HTMLElement | null;
      if (!btn) return;
      this.game.bet(parseInt(btn.dataset.amount ?? "0"));
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
    this.$("bet-display").textContent = state.bet > 0 ? String(state.bet) : "—";

    const msg = this.$("message");
    msg.textContent = state.message;
    msg.className = `message-bar${state.outcome ? ` acey-${state.outcome}` : ""}`;

    const cardsEl = this.$("acey-cards");
    cardsEl.innerHTML =
      (state.card1 ? renderCard(state.card1) : renderFaceDownCard()) +
      (state.card3 ? renderCard(state.card3) : renderFaceDownCard()) +
      (state.card2 ? renderCard(state.card2) : renderFaceDownCard());

    this.$("acey-bracket").textContent =
      state.lo !== null && state.hi !== null
        ? `Between ${valueLabel(state.lo)} and ${valueLabel(state.hi)} · win 1:1 · post loses double`
        : "";

    const dealBtn = this.$("deal-btn");
    const callBtns = this.$("call-buttons");
    const betBtns = this.$("bet-buttons");
    const nextBtn = this.$("next-round-btn");
    dealBtn.classList.add("hidden");
    callBtns.classList.add("hidden");
    betBtns.classList.add("hidden");
    nextBtn.classList.add("hidden");

    if (state.phase === "DEAL") {
      dealBtn.classList.remove("hidden");
    } else if (state.phase === "CALL_ACE") {
      callBtns.classList.remove("hidden");
    } else if (state.phase === "BETTING") {
      betBtns.innerHTML = betOptions(balance())
        .map(
          (n) =>
            `<button class="acey-bet-btn" data-amount="${n}">${n}</button>`,
        )
        .join("");
      betBtns.classList.remove("hidden");
    } else {
      nextBtn.classList.remove("hidden");
    }
  }
}
