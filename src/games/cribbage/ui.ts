import { type PlayingCard, Suit } from "typedeck";
import { CribbageGame } from "./game";
import {
  SUIT_SYMBOL,
  RANK_DISPLAY,
  isRed,
  peggingValue,
  cardKey,
  type Player,
  type GamePhase,
} from "./types";
import { canPlay } from "./scoring";

export class CribbageUI {
  private game: CribbageGame;
  private selectedIndices = new Set<number>();
  private animating = false;

  constructor() {
    this.game = new CribbageGame();
    this.bindEvents();
    this.render();
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("action-btn").addEventListener("click", () => this.onAction());
    this.$("new-game-btn").addEventListener("click", () => this.onNewGame());
  }

  private onNewGame(): void {
    this.game.newGame();
    this.selectedIndices.clear();
    this.render();
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
        this.game.newGame();
        this.selectedIndices.clear();
        this.render();
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
      const state = this.game.getState();
      if (state.phase === "GAME_OVER") break;

      if (state.currentTurn === "computer") {
        await this.delay(600);
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

      // Player's turn
      if (!canPlay(state.playerPeggingHand, state.peggingCount)) {
        const result = this.game.playerGo();
        this.showMessage(
          result.details.length > 0 ? result.details[0] : "You say Go",
        );
        this.render();
        await this.delay(600);
        continue;
      }

      // Wait for player to click a card
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

    // Award last card
    if (this.game.getState().phase !== "GAME_OVER") {
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
    this.render();
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

    this.$("scoring-details").innerHTML = result.points.length
      ? result.points.map((p) => `<div>${p.name}: ${p.points}</div>`).join("")
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

    // Scores
    this.$("player-score").textContent = String(state.playerScore);
    this.$("computer-score").textContent = String(state.computerScore);
    this.renderBoard(state.playerScore, state.computerScore);

    // Dealer indicator
    this.$("player-dealer").textContent =
      state.dealer === "player" ? "(Dealer)" : "";
    this.$("computer-dealer").textContent =
      state.dealer === "computer" ? "(Dealer)" : "";

    // Message
    this.$("message").textContent = state.message;

    // Computer hand
    this.renderComputerHand(state);

    // Starter
    this.renderStarter(state.starterCard);

    // Pegging area
    this.renderPeggingArea(state);

    // Player hand
    this.renderPlayerHand(state);

    // Action button
    this.renderActionButton(state.phase);

    // Scoring details
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

    const cards = state.computerHand;
    container.innerHTML = cards
      .map((card, i) =>
        showCards
          ? this.renderCard(card, i, false, false)
          : `<div class="card face-down" data-index="${i}"></div>`,
      )
      .join("");
  }

  private renderStarter(card: PlayingCard | null): void {
    const container = this.$("starter-area");
    if (card) {
      container.innerHTML =
        `<div class="starter-label">Starter</div>` +
        this.renderCard(card, -1, false, false);
    } else {
      container.innerHTML = `<div class="card face-down deck-placeholder"></div>`;
    }
  }

  private renderPeggingArea(state: ReturnType<CribbageGame["getState"]>): void {
    const container = this.$("pegging-area");
    if (state.phase !== "PEGGING" && state.peggingPile.length === 0) {
      container.innerHTML = "";
      this.$("pegging-count").textContent = "";
      return;
    }

    container.innerHTML = state.peggingPile
      .map((card, i) => this.renderCard(card, i, false, false, true))
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
        const selected = isDiscarding && this.selectedIndices.has(i);
        const playable =
          isPegging &&
          state.currentTurn === "player" &&
          peggingValue(card) + state.peggingCount <= 31;
        return this.renderCard(card, i, selected, isPegging && !playable);
      })
      .join("");

    if (isDiscarding) {
      container.querySelectorAll(".card").forEach((el) => {
        el.addEventListener("click", (e) => {
          const target = e.currentTarget as HTMLElement;
          const idx = parseInt(target.dataset.index || "-1");
          if (idx < 0) return;

          if (this.selectedIndices.has(idx)) {
            this.selectedIndices.delete(idx);
          } else if (this.selectedIndices.size < 2) {
            this.selectedIndices.add(idx);
          }
          this.render();
        });
      });
    }
  }

  private renderCard(
    card: PlayingCard,
    index: number,
    selected: boolean,
    dimmed: boolean,
    small = false,
  ): string {
    const red = isRed(card);
    const rank = RANK_DISPLAY[card.cardName];
    const suit = SUIT_SYMBOL[card.suit];
    const classes = [
      "card",
      red ? "red" : "black",
      selected ? "selected" : "",
      dimmed ? "dimmed" : "",
      small ? "small" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `
      <div class="${classes}" data-index="${index}" data-key="${cardKey(card)}">
        <div class="card-corner top">${rank}<br>${suit}</div>
        <div class="card-center">${suit}</div>
        <div class="card-corner bottom">${rank}<br>${suit}</div>
      </div>
    `;
  }

  private renderActionButton(phase: GamePhase): void {
    const btn = this.$("action-btn") as HTMLButtonElement;
    switch (phase) {
      case "NEW_GAME":
        btn.textContent = "Deal";
        btn.classList.remove("hidden");
        break;
      case "DISCARDING":
        btn.textContent = `Discard to Crib (${this.selectedIndices.size}/2)`;
        btn.disabled = this.selectedIndices.size !== 2;
        btn.classList.remove("hidden");
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
        btn.textContent = "New Game";
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
