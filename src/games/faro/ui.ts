import { FaroGame } from "./game";
import { RANK_COUNT, TURNS_PER_SHOE } from "./types";
import { renderCard } from "../../shared/ui/cards";
import { RANK_DISPLAY } from "../../shared/deck";
import { betOptions } from "../../shared/engine/betting";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";

export class FaroUI {
  private game: FaroGame;
  private selectedChip = 0;

  constructor() {
    document.getElementById("app")!.innerHTML = FaroUI.template();
    this.game = new FaroGame();
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
          <h1>Faro</h1>
        </div>
        <div class="header-right">
          <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
        </div>
      </div>

      <div class="scoreboard">
        <div class="score-row">
          <span class="score-label">Balance</span>
          <span class="score-value" id="faro-balance"></span>
        </div>
        <div class="score-row">
          <span class="score-label">Turn</span>
          <span class="score-value" id="faro-turn-no"></span>
        </div>
      </div>

      <div class="faro-turn">
        <div class="faro-slot">
          <span class="faro-slot-label">Soda</span>
          <div id="faro-soda"></div>
        </div>
        <div class="faro-slot">
          <span class="faro-slot-label">Banker · loses</span>
          <div id="faro-banker"></div>
        </div>
        <div class="faro-slot">
          <span class="faro-slot-label">Player · wins</span>
          <div id="faro-player"></div>
        </div>
        <div class="faro-slot hidden" id="faro-hock-slot">
          <span class="faro-slot-label">Hock</span>
          <div id="faro-hock"></div>
        </div>
      </div>

      <div class="faro-layout" id="faro-layout"></div>
      <div class="faro-casekeeper" id="faro-casekeeper"></div>

      <div class="message-bar" id="faro-message"></div>

      <div class="action-area">
        <div class="faro-chip-row" id="faro-chips"></div>
        <button id="faro-draw-btn">Draw Turn</button>
        <button id="faro-new-shoe-btn">New Shoe</button>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("faro"),
    );

    this.$("faro-chips").addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest(
        "[data-chip]",
      ) as HTMLElement | null;
      if (!btn) return;
      this.selectedChip = parseInt(btn.dataset.chip ?? "0");
      this.render();
    });

    this.$("faro-layout").addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const cell = target.closest("[data-rank]") as HTMLElement | null;
      if (!cell) return;
      const rank = Number(cell.dataset.rank);
      const action = (target.closest("[data-action]") as HTMLElement | null)
        ?.dataset.action;
      if (action === "copper") this.game.toggleCopper(rank);
      else if (action === "remove") this.game.removeBet(rank);
      else if (this.game.getState().caseCounts[rank] === 4) return;
      else this.game.placeBet(rank, this.selectedChip);
      this.render();
    });

    this.$("faro-draw-btn").addEventListener("click", () => {
      this.game.drawTurn();
      this.render();
    });

    this.$("faro-new-shoe-btn").addEventListener("click", () => {
      const midShoe = this.game.getState().phase !== "SHOE_OVER";
      const start = () => {
        this.game.newShoe();
        this.render();
      };
      if (midShoe) confirmIfEnabled("Abandon this shoe?", start);
      else start();
    });
  }

  private render(): void {
    const state = this.game.getState();

    this.$("faro-balance").textContent = String(state.balance);
    this.$("faro-turn-no").textContent =
      `${state.turnNumber}/${TURNS_PER_SHOE}`;
    this.$("faro-message").textContent = state.message;

    this.$("faro-soda").innerHTML = renderCard(state.soda, { small: true });
    this.$("faro-banker").innerHTML = state.lastTurn
      ? renderCard(state.lastTurn.bankerCard)
      : "";
    this.$("faro-player").innerHTML = state.lastTurn
      ? renderCard(state.lastTurn.playerCard)
      : "";
    this.$("faro-hock-slot").classList.toggle("hidden", state.hock === null);
    this.$("faro-hock").innerHTML = state.hock
      ? renderCard(state.hock, { small: true })
      : "";

    this.renderLayout();
    this.renderCasekeeper();
    this.renderControls();
  }

  private renderLayout(): void {
    const state = this.game.getState();
    const cells: string[] = [];
    for (let rank = 0; rank < RANK_COUNT; rank++) {
      const bet = state.bets.find((b) => b.rank === rank);
      const seen = state.caseCounts[rank]!;
      const classes = [
        "faro-cell",
        seen === 4 ? "faro-dead" : "",
        seen === 3 ? "faro-case-rank" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const chip = bet
        ? `<span class="faro-chip${bet.coppered ? " faro-coppered" : ""}">${bet.wager.amount}</span>
           <span class="faro-cell-ctrls">
             <button data-action="copper" title="Copper (reverse) this bet">⊙</button>
             <button data-action="remove" title="Take down this bet">×</button>
           </span>`
        : "";
      cells.push(
        `<div class="${classes}" data-rank="${rank}">
          <span class="faro-cell-rank">${RANK_DISPLAY[rank]}♠</span>${chip}
        </div>`,
      );
    }
    this.$("faro-layout").innerHTML = cells.join("");
  }

  private renderCasekeeper(): void {
    const state = this.game.getState();
    const cols: string[] = [];
    for (let rank = 0; rank < RANK_COUNT; rank++) {
      const seen = state.caseCounts[rank]!;
      const dots = Array.from(
        { length: 4 },
        (_, i) =>
          `<span class="faro-dot${i < seen ? " faro-seen" : ""}"></span>`,
      ).join("");
      const cls = [
        "faro-case-col",
        seen === 4 ? "faro-dead" : "",
        seen === 3 ? "faro-case-rank" : "",
      ]
        .filter(Boolean)
        .join(" ");
      cols.push(
        `<div class="${cls}"><span>${RANK_DISPLAY[rank]}</span>${dots}</div>`,
      );
    }
    this.$("faro-casekeeper").innerHTML = cols.join("");
  }

  private renderControls(): void {
    const state = this.game.getState();
    const options = betOptions(state.balance);
    if (!options.includes(this.selectedChip)) {
      this.selectedChip = options[0] ?? 0;
    }
    this.$("faro-chips").innerHTML = options
      .map(
        (n) =>
          `<button class="faro-chip-btn${n === this.selectedChip ? " faro-selected" : ""}" data-chip="${n}">${n}</button>`,
      )
      .join("");
    (this.$("faro-draw-btn") as HTMLButtonElement).disabled =
      state.phase === "SHOE_OVER";
  }
}
