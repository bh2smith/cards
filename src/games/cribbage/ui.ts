import { type PlayingCard } from "typedeck";
import { CribbageGame } from "./game";
import { peggingValue, type Player, type GamePhase } from "./types";
import { canPlay } from "./scoring";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";
import { LeaderboardReporter, GameId } from "../../shared/circles/leaderboard";

export class CribbageUI {
  private game: CribbageGame;
  private selectedIndices = new Set<number>();
  private animating = false;
  private destroyed = false;
  private reporter = new LeaderboardReporter(GameId.Cribbage);

  constructor() {
    document.getElementById("app")!.innerHTML = CribbageUI.template();
    this.game = new CribbageGame();
    this.bindEvents();
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    document.getElementById("app")!.innerHTML = "";
  }

  static template(): string {
    return `
      <div class="cribbage">
        <div class="header">
          <div class="header-left">
            <a href="#" class="back-link">← Games</a>
            <h1>Cribbage</h1>
          </div>
          <div class="header-right">
            <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
            <button id="new-game-btn">New Game</button>
          </div>
        </div>

        <div class="crib-scorebar">
          <div class="crib-scores">
            <div class="crib-score-row">
              <span class="crib-score-name">YOU</span>
              <span class="crib-dealer-dot" id="player-dealer"></span>
              <div class="board-track">
                <div class="board-peg" id="player-peg"></div>
              </div>
              <span class="crib-score-val" id="player-score">0</span>
            </div>
            <div class="crib-score-row">
              <span class="crib-score-name">CPU</span>
              <span class="crib-dealer-dot" id="computer-dealer"></span>
              <div class="board-track">
                <div class="board-peg" id="computer-peg"></div>
              </div>
              <span class="crib-score-val" id="computer-score">0</span>
            </div>
          </div>
        </div>

        <div class="hand-area" id="computer-hand"></div>

        <div class="play-area">
          <div id="starter-area"></div>
          <div id="crib-zone" class="hidden"></div>
          <div id="pegging-area"></div>
          <div id="pegging-count"></div>
          <div class="scoring-info">
            <div id="scoring-details" class="hidden"></div>
            <div id="scoring-total" class="hidden"></div>
          </div>
        </div>

        <div class="hand-area" id="player-hand"></div>

        <div class="message-bar" id="message">Welcome to Cribbage!</div>

        <div class="action-area">
          <button id="action-btn">Deal</button>
        </div>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private goToLobby(): void {
    location.hash = "/";
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("cribbage"),
    );
    this.$("action-btn").addEventListener("click", () => this.onAction());
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => this.goToLobby()),
    );
  }

  private onAction(): void {
    if (this.animating) return;
    const state = this.game.getState();

    switch (state.phase) {
      case "NEW_GAME":
        this.game.deal();
        this.selectedIndices.clear();
        this.render();
        break;

      case "DISCARDING":
        if (this.selectedIndices.size !== 2) return;
        this.game.playerDiscard([...this.selectedIndices]);
        this.selectedIndices.clear();
        this.render();
        break;

      case "CUTTING":
        this.doCut();
        break;

      case "ROUND_OVER":
        this.game.nextRound();
        this.selectedIndices.clear();
        this.render();
        break;

      case "GAME_OVER":
        this.goToLobby();
        break;

      case "COUNTING_NONDEALER":
      case "COUNTING_DEALER":
      case "COUNTING_CRIB":
        this.doCounting();
        break;
    }
  }

  private async doCut(): Promise<void> {
    const { hisHeels } = this.game.cut();
    this.render();
    if (this.game.getState().phase === "GAME_OVER") return;

    await this.delay(hisHeels ? 1500 : 800);
    await this.runPegging();
  }

  private async runPegging(): Promise<void> {
    this.animating = true;
    this.render();

    while (!this.game.isPeggingDone()) {
      if (this.destroyed) return;
      const state = this.game.getState();
      if (state.phase === "GAME_OVER") break;

      if (state.currentTurn === "computer") {
        await this.delay(600);
        if (this.destroyed) return;
        const result = this.game.computerPlay();
        this.renderPeggingUpdate(
          result.card,
          "computer",
          result.pointsScored,
          result.details,
        );
        this.render();

        if (result.countReset) await this.delay(400);
        if (this.game.isPeggingDone()) break;
        continue;
      }

      if (!canPlay(state.playerPeggingHand, state.peggingCount)) {
        const result = this.game.playerGo();
        this.showMessage(result.details[0] ?? "You say Go");
        this.render();
        await this.delay(600);
        continue;
      }

      const card = await this.waitForPlayerPeggingCard();
      if (!card) continue;

      const result = this.game.playerPlayPeggingCard(card);
      if (result.card) {
        this.renderPeggingUpdate(
          result.card,
          "player",
          result.pointsScored,
          result.details,
        );
        this.render();
        if (result.countReset) await this.delay(400);
      }
    }

    if (!this.destroyed && this.game.getState().phase !== "GAME_OVER") {
      const lastCard = this.game.awardLastCard();
      if (lastCard) {
        this.showMessage(
          `Last card: ${lastCard.who === "player" ? "You get" : "Computer gets"} 1`,
        );
        this.render();
        await this.delay(800);
      }

      this.game.startCounting();
      this.render();
    }

    this.animating = false;
    if (!this.destroyed) this.render();
  }

  private waitForPlayerPeggingCard(): Promise<PlayingCard | null> {
    return new Promise((resolve) => {
      const state = this.game.getState();
      const container = this.$("player-hand");

      const handler = (e: Event) => {
        const target = (e.target as HTMLElement).closest(
          ".card",
        ) as HTMLElement;
        if (!target) return;

        const idx = parseInt(target.dataset.index || "-1");
        if (idx < 0 || idx >= state.playerPeggingHand.length) return;

        const card = state.playerPeggingHand[idx];
        if (!card) return;
        if (peggingValue(card) + state.peggingCount > 31) {
          this.showMessage("That card would exceed 31!");
          return;
        }

        container.removeEventListener("click", handler);
        resolve(card);
      };

      container.addEventListener("click", handler);
      this.render();
    });
  }

  private async doCounting(): Promise<void> {
    const result = this.game.scoreCurrentPhaseHand();
    const state = this.game.getState();

    const grouped = new Map<string, number>();
    for (const p of result.points) {
      grouped.set(p.name, (grouped.get(p.name) ?? 0) + 1);
    }
    const pointsByName = new Map<string, number>();
    for (const p of result.points) {
      pointsByName.set(p.name, p.points);
    }

    const lines = [...grouped.entries()].map(([name, count]) => {
      const pts = pointsByName.get(name)! * count;
      return count > 1
        ? `<div>${name} (×${count}): ${pts}</div>`
        : `<div>${name}: ${pts}</div>`;
    });

    this.$("scoring-details").innerHTML = lines.length
      ? lines.join("")
      : "<div>No points</div>";
    this.$("scoring-details").classList.remove("hidden");
    this.$("scoring-total").textContent = `Total: ${result.score}`;
    this.$("scoring-total").classList.remove("hidden");

    this.render();

    if (state.phase !== "GAME_OVER") {
      this.game.advanceCounting();
    }
  }

  private renderPeggingUpdate(
    card: PlayingCard | null,
    who: Player,
    points: number,
    details: string[],
  ): void {
    if (details.length > 0) {
      this.showMessage(
        `${who === "player" ? "You" : "Computer"}: ${details.join(", ")} (+${points})`,
      );
    }
  }

  private showMessage(msg: string): void {
    this.$("message").textContent = msg;
  }

  private render(): void {
    const state = this.game.getState();

    this.reporter.reportVsAi(state.phase, state.winner === "player");

    this.$("player-score").textContent = String(state.playerScore);
    this.$("computer-score").textContent = String(state.computerScore);
    this.renderBoard(state.playerScore, state.computerScore);

    this.$("player-dealer").classList.toggle(
      "active",
      state.dealer === "player",
    );
    this.$("computer-dealer").classList.toggle(
      "active",
      state.dealer === "computer",
    );

    this.$("message").textContent = state.message;

    this.renderComputerHand(state);
    this.renderStarter(state.starterCard);
    this.renderCribZone(state);
    this.renderPeggingArea(state);
    this.renderPlayerHand(state);
    this.renderActionButton(state.phase);

    if (
      state.phase !== "COUNTING_NONDEALER" &&
      state.phase !== "COUNTING_DEALER" &&
      state.phase !== "COUNTING_CRIB"
    ) {
      this.$("scoring-details").classList.add("hidden");
      this.$("scoring-total").classList.add("hidden");
    }
  }

  private renderComputerHand(
    state: ReturnType<CribbageGame["getState"]>,
  ): void {
    const container = this.$("computer-hand");
    const showCards =
      state.phase === "COUNTING_NONDEALER" ||
      state.phase === "COUNTING_DEALER" ||
      state.phase === "COUNTING_CRIB" ||
      state.phase === "ROUND_OVER" ||
      state.phase === "GAME_OVER";

    container.innerHTML = state.computerHand
      .map((card, i) =>
        showCards ? renderCard(card, { index: i }) : renderFaceDownCard(i),
      )
      .join("");
  }

  private renderStarter(card: PlayingCard | null): void {
    const container = this.$("starter-area");
    if (card) {
      container.innerHTML =
        `<div class="starter-label">Starter</div>` + renderCard(card);
    } else {
      container.innerHTML = renderFaceDownCard(-1) + "";
      // deck placeholder styling
      container.querySelector(".card")!.classList.add("deck-placeholder");
    }
  }

  private renderCribZone(state: ReturnType<CribbageGame["getState"]>): void {
    const zone = this.$("crib-zone");

    if (state.phase !== "DISCARDING") {
      zone.classList.add("hidden");
      return;
    }

    zone.classList.remove("hidden");

    const cribOwner = state.dealer === "player" ? "Your" : "Opponent's";
    const selected = [...this.selectedIndices].sort((a, b) => a - b);
    const cardsHtml = selected
      .map((i) => renderCard(state.playerHand[i], { index: i }))
      .join("");
    const slotsHtml = Array(2 - selected.length)
      .fill('<div class="crib-slot"></div>')
      .join("");
    const hint =
      selected.length < 2
        ? '<div class="crib-zone-hint">Tap cards to place here</div>'
        : "";

    zone.innerHTML = `
      <div class="crib-zone-label">${cribOwner} Crib</div>
      <div class="crib-zone-cards">${cardsHtml}${slotsHtml}</div>
      ${hint}
    `;

    zone.querySelectorAll(".card").forEach((el) => {
      el.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLElement;
        const idx = parseInt(target.dataset.index || "-1");
        if (idx >= 0 && this.selectedIndices.has(idx)) {
          this.selectedIndices.delete(idx);
          this.render();
        }
      });
    });
  }

  private renderPeggingArea(state: ReturnType<CribbageGame["getState"]>): void {
    const container = this.$("pegging-area");
    if (state.phase !== "PEGGING" && state.peggingPile.length === 0) {
      container.innerHTML = "";
      this.$("pegging-count").textContent = "";
      return;
    }

    container.innerHTML = state.peggingPile
      .map((card, i) => renderCard(card, { index: i, small: true }))
      .join("");

    this.$("pegging-count").textContent =
      state.phase === "PEGGING" ? `Count: ${state.peggingCount}` : "";
  }

  private renderPlayerHand(state: ReturnType<CribbageGame["getState"]>): void {
    const container = this.$("player-hand");
    const isPegging = state.phase === "PEGGING";
    const isDiscarding = state.phase === "DISCARDING";

    const cards = isPegging ? state.playerPeggingHand : state.playerHand;
    container.innerHTML = cards
      .map((card, i) => {
        if (isDiscarding && this.selectedIndices.has(i)) return "";
        const playable =
          isPegging &&
          state.currentTurn === "player" &&
          peggingValue(card) + state.peggingCount <= 31;
        return renderCard(card, {
          index: i,
          dimmed: isPegging && !playable,
        });
      })
      .join("");

    if (isDiscarding) {
      container.querySelectorAll(".card").forEach((el) => {
        el.addEventListener("click", (e) => {
          const target = e.currentTarget as HTMLElement;
          const idx = parseInt(target.dataset.index || "-1");
          if (idx < 0 || this.selectedIndices.size >= 2) return;
          this.selectedIndices.add(idx);
          this.render();
        });
      });
    }
  }

  private renderActionButton(phase: GamePhase): void {
    const btn = this.$("action-btn") as HTMLButtonElement;
    switch (phase) {
      case "NEW_GAME":
        btn.textContent = "Deal";
        btn.disabled = false;
        btn.classList.remove("hidden");
        break;
      case "DISCARDING":
        if (this.selectedIndices.size === 2) {
          btn.textContent = "Confirm Crib Cards";
          btn.disabled = false;
          btn.classList.remove("hidden");
        } else {
          btn.classList.add("hidden");
        }
        break;
      case "CUTTING":
        btn.textContent = "Cut for Starter";
        btn.disabled = false;
        btn.classList.remove("hidden");
        break;
      case "PEGGING":
        btn.classList.add("hidden");
        break;
      case "COUNTING_NONDEALER":
      case "COUNTING_DEALER":
      case "COUNTING_CRIB":
        btn.textContent = "Count Hand";
        btn.disabled = false;
        btn.classList.remove("hidden");
        break;
      case "ROUND_OVER":
        btn.textContent = "Next Round";
        btn.disabled = false;
        btn.classList.remove("hidden");
        break;
      case "GAME_OVER":
        btn.textContent = "Back to Game Room";
        btn.disabled = false;
        btn.classList.remove("hidden");
        break;
      default:
        btn.classList.add("hidden");
    }
  }

  private renderBoard(playerScore: number, computerScore: number): void {
    const playerPeg = this.$("player-peg");
    const computerPeg = this.$("computer-peg");
    playerPeg.style.width = `${(playerScore / 121) * 100}%`;
    computerPeg.style.width = `${(computerScore / 121) * 100}%`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
