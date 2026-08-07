import { WarGame } from "./game";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { randomSeed } from "../../shared/deck";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";

const AUTO_PLAY_MS = 400;

export class WarUI {
  private game: WarGame;
  private autoTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    document.getElementById("app")!.innerHTML = WarUI.template();
    this.game = new WarGame({ seed: randomSeed() });
    this.bindEvents();
    this.render();
  }

  destroy(): void {
    this.stopAuto();
    document.getElementById("app")!.innerHTML = "";
  }

  static template(): string {
    return `
      <div class="header">
        <div class="header-left">
          <a href="#" class="back-link">← Games</a>
          <h1>War</h1>
        </div>
        <div class="header-right">
          <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
          <button id="new-game-btn">New Game</button>
        </div>
      </div>

      <div class="war-table">
        <div class="war-side" id="war-computer"></div>
        <div class="war-battlefield" id="war-battlefield"></div>
        <div class="war-side" id="war-player"></div>
      </div>

      <div class="message-bar" id="message"></div>

      <div class="war-controls">
        <button id="war-flip-btn">Flip</button>
        <label class="war-auto-label">
          <input type="checkbox" id="war-auto-toggle"> Auto-play
        </label>
        <button id="war-restart-btn" class="hidden">New Game</button>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () => openInstructions("war"));
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => {
        location.hash = "/";
      }),
    );
    this.$("war-flip-btn").addEventListener("click", () => this.onFlip());
    this.$("war-restart-btn").addEventListener("click", () => this.onNewGame());
    this.$("war-auto-toggle").addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      if (checked) this.startAuto();
      else this.stopAuto();
    });
  }

  private onFlip(): void {
    this.game.flip();
    this.render();
  }

  private onNewGame(): void {
    this.stopAuto();
    this.game = new WarGame({ seed: randomSeed() });
    this.render();
  }

  private startAuto(): void {
    if (this.autoTimer !== null) return;
    this.autoTimer = setInterval(() => this.onFlip(), AUTO_PLAY_MS);
  }

  private stopAuto(): void {
    if (this.autoTimer !== null) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
    const toggle = document.getElementById(
      "war-auto-toggle",
    ) as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
  }

  private render(): void {
    const state = this.game.getState();
    this.$("message").textContent = state.message;

    this.renderSide(
      "war-computer",
      "Computer",
      state.computerPile.length,
      state.computerBuried,
    );
    this.renderSide(
      "war-player",
      "You",
      state.playerPile.length,
      state.playerBuried,
    );
    this.renderBattlefield();

    const flipBtn = this.$("war-flip-btn") as HTMLButtonElement;
    flipBtn.disabled = state.phase === "GAME_OVER";
    flipBtn.textContent = state.phase === "WAR" ? "Flip (War!)" : "Flip";
    this.$("war-restart-btn").classList.toggle(
      "hidden",
      state.phase !== "GAME_OVER",
    );
    if (state.phase === "GAME_OVER") this.stopAuto();
  }

  private renderSide(
    id: string,
    label: string,
    pileCount: number,
    buried: number,
  ): void {
    const pile =
      pileCount > 0 ? renderFaceDownCard() : `<div class="card-slot"></div>`;
    const buriedStack =
      buried > 0
        ? `<div class="war-pile">
             <div class="war-buried-stack">${Array.from(
               { length: buried },
               () => renderFaceDownCard(-1, true),
             ).join("")}</div>
             <div class="pile-label">Buried (${buried})</div>
           </div>`
        : "";
    this.$(id).innerHTML = `
      <div class="war-pile">
        ${pile}
        <div class="pile-label">${label} (${pileCount})</div>
      </div>
      ${buriedStack}
    `;
  }

  private renderBattlefield(): void {
    const state = this.game.getState();
    const slot = (
      card: ReturnType<WarGame["getState"]>["playerBattle"],
      owner: "player" | "computer",
    ) => {
      const won = state.battleWinner === owner ? " war-winner" : "";
      return `<div class="war-battle-slot${won}">
        ${card ? renderCard(card) : `<div class="card-slot"></div>`}
      </div>`;
    };

    const atStake =
      state.table.length + (state.playerBattle && state.computerBattle ? 2 : 0);
    const spoils =
      state.table.length > 0
        ? `<div class="war-spoils">${atStake} cards at stake</div>`
        : "";

    this.$("war-battlefield").innerHTML = `
      ${slot(state.computerBattle, "computer")}
      ${slot(state.playerBattle, "player")}
      ${spoils}
    `;
  }
}
