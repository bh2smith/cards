import { type PlayingCard } from "typedeck";
import { HeartsGame } from "./game";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { cardKey } from "../../shared/deck";
import {
  type HeartsState,
  type PlayerIndex,
  type Trick,
  cardPoints,
} from "./types";
import { confirmIfEnabled } from "../../shared/settings";

const BOT_DELAY_MS = 600;
const TRICK_HOLD_MS = 1100;

const PLAYER_LABELS = ["You", "Left", "Top", "Right"];

export class HeartsUI {
  private game: HeartsGame;
  private destroyed = false;
  private animating = false;
  private selectedPass: number[] = [];
  private completedTrickToShow: Trick | null = null;

  constructor() {
    document.getElementById("app")!.innerHTML = HeartsUI.template();
    this.game = new HeartsGame();
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
          <h1>Hearts</h1>
        </div>
        <button id="new-game-btn">New Game</button>
      </div>

      <div class="hearts-scoreboard">
        ${[0, 1, 2, 3]
          .map(
            (i) => `
          <div class="hearts-score-cell" id="hearts-score-cell-${i}">
            <div class="hearts-score-label">${PLAYER_LABELS[i]}</div>
            <div class="hearts-score-total" id="hearts-score-total-${i}">0</div>
            <div class="hearts-score-round" id="hearts-score-round-${i}">+0</div>
          </div>`,
          )
          .join("")}
      </div>

      <div class="hearts-table">
        <div class="hearts-seat hearts-seat-top">
          <div class="hearts-seat-label">Top</div>
          <div class="hearts-bot-hand" id="hearts-hand-2"></div>
        </div>
        <div class="hearts-seat hearts-seat-left">
          <div class="hearts-seat-label">Left</div>
          <div class="hearts-bot-hand" id="hearts-hand-1"></div>
        </div>
        <div class="hearts-play-area" id="hearts-play-area"></div>
        <div class="hearts-seat hearts-seat-right">
          <div class="hearts-seat-label">Right</div>
          <div class="hearts-bot-hand" id="hearts-hand-3"></div>
        </div>
      </div>

      <div class="hand-area" id="hearts-hand-0"></div>

      <div class="message-bar" id="hearts-message"></div>

      <div class="action-area">
        <button id="hearts-pass-btn" class="hidden">Pass 3 Cards</button>
        <button id="hearts-next-btn" class="hidden">Next Round</button>
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
    this.$("hearts-pass-btn").addEventListener("click", () => this.onPass());
    this.$("hearts-next-btn").addEventListener("click", () => this.onNext());
    this.$("hearts-hand-0").addEventListener("click", (e) =>
      this.onHandClick(e),
    );
  }

  private onHandClick(e: Event): void {
    if (this.animating) return;
    const target = (e.target as HTMLElement).closest(".card") as HTMLElement;
    if (!target) return;
    const index = parseInt(target.dataset.index ?? "-1");
    if (index < 0) return;

    const state = this.game.getState();
    if (state.phase === "PASSING") {
      this.togglePassSelection(index);
      this.render();
    } else if (state.phase === "PLAYING" && state.currentTurn === 0) {
      const card = state.hands[0]![index];
      if (!card) return;
      const legals = this.game.legalPlaysFor(0);
      if (!legals.some((c) => cardKey(c) === cardKey(card))) return;
      this.game.playCard(0, card);
      this.afterPlay();
    }
  }

  private togglePassSelection(index: number): void {
    const i = this.selectedPass.indexOf(index);
    if (i >= 0) this.selectedPass.splice(i, 1);
    else if (this.selectedPass.length < 3) this.selectedPass.push(index);
  }

  private onPass(): void {
    if (this.selectedPass.length !== 3) return;
    this.game.selectBotPasses();
    this.game.selectPass(0, this.selectedPass);
    this.game.executePass();
    this.selectedPass = [];
    this.render();
    this.maybeRunBots();
  }

  private onNext(): void {
    const state = this.game.getState();
    if (state.phase === "ROUND_OVER") {
      this.game.nextRound();
      this.completedTrickToShow = null;
      this.render();
      this.maybeRunBots();
    } else if (state.phase === "GAME_OVER") {
      location.hash = "/";
    }
  }

  private afterPlay(): void {
    const state = this.game.getState();
    const lastTrick = state.completedTricks[state.completedTricks.length - 1];
    const inCompletedFrame =
      state.currentTrick !== null &&
      state.currentTrick.plays.length === 0 &&
      lastTrick !== undefined;

    if (inCompletedFrame) {
      this.completedTrickToShow = lastTrick;
      this.render();
      this.holdTrickThenContinue();
    } else if (state.phase === "ROUND_OVER" || state.phase === "GAME_OVER") {
      this.render();
    } else {
      this.render();
      this.maybeRunBots();
    }
  }

  private async holdTrickThenContinue(): Promise<void> {
    this.animating = true;
    await this.delay(TRICK_HOLD_MS);
    if (this.destroyed) return;
    this.animating = false;
    this.completedTrickToShow = null;
    this.render();
    this.maybeRunBots();
  }

  private async maybeRunBots(): Promise<void> {
    if (this.destroyed) return;
    const state = this.game.getState();
    if (state.phase !== "PLAYING") return;
    if (state.currentTurn === 0) return;
    if (this.animating) return;

    this.animating = true;
    await this.delay(BOT_DELAY_MS);
    if (this.destroyed) return;
    this.game.botPlay();
    this.animating = false;

    const after = this.game.getState();
    const lastTrick = after.completedTricks[after.completedTricks.length - 1];
    const justCompleted =
      after.currentTrick !== null &&
      after.currentTrick.plays.length === 0 &&
      lastTrick !== undefined;

    if (justCompleted) {
      this.completedTrickToShow = lastTrick;
      this.render();
      this.holdTrickThenContinue();
    } else {
      this.render();
      this.maybeRunBots();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();

    this.renderScoreboard(state);
    this.renderBotHands(state);
    this.renderPlayerHand(state);
    this.renderPlayArea(state);
    this.renderMessage(state);
    this.renderButtons(state);
  }

  private renderScoreboard(state: HeartsState): void {
    for (let i = 0; i < 4; i++) {
      this.$(`hearts-score-total-${i}`).textContent = String(state.scores[i]);
      const round =
        state.roundResult?.pointsByPlayer[i] ?? state.roundScores[i] ?? 0;
      this.$(`hearts-score-round-${i}`).textContent =
        round > 0 ? `+${round}` : "+0";
      const cell = this.$(`hearts-score-cell-${i}`);
      cell.classList.toggle(
        "hearts-score-cell-active",
        state.phase === "PLAYING" && state.currentTurn === i,
      );
    }
  }

  private renderBotHands(state: HeartsState): void {
    for (const i of [1, 2, 3] as PlayerIndex[]) {
      const container = this.$(`hearts-hand-${i}`);
      const cards = state.hands[i]!;
      const reveal =
        state.phase === "ROUND_OVER" || state.phase === "GAME_OVER";
      if (reveal) {
        container.innerHTML = cards
          .map((c) => renderCard(c, { small: true }))
          .join("");
      } else {
        container.innerHTML = cards
          .map((_, idx) => renderFaceDownCard(idx, true))
          .join("");
      }
    }
  }

  private renderPlayerHand(state: HeartsState): void {
    const container = this.$("hearts-hand-0");
    const hand = state.hands[0]!;

    if (state.phase === "PASSING") {
      container.innerHTML = hand
        .map((c, idx) =>
          renderCard(c, {
            index: idx,
            selected: this.selectedPass.includes(idx),
          }),
        )
        .join("");
      container.style.cursor = "pointer";
      return;
    }

    const isMyTurn = state.phase === "PLAYING" && state.currentTurn === 0;
    const legals = isMyTurn
      ? new Set(this.game.legalPlaysFor(0).map(cardKey))
      : new Set<string>();

    container.innerHTML = hand
      .map((c, idx) =>
        renderCard(c, {
          index: idx,
          dimmed: isMyTurn && !legals.has(cardKey(c)),
        }),
      )
      .join("");
    container.style.cursor = isMyTurn ? "pointer" : "default";
  }

  private renderPlayArea(state: HeartsState): void {
    const area = this.$("hearts-play-area");
    let trick: Trick | null;
    if (this.completedTrickToShow) {
      trick = this.completedTrickToShow;
    } else if (state.currentTrick && state.currentTrick.plays.length > 0) {
      trick = state.currentTrick;
    } else {
      trick = null;
    }

    if (!trick) {
      area.innerHTML = `<div class="hearts-play-empty">${state.phase === "PASSING" ? "Select 3 cards to pass" : ""}</div>`;
      return;
    }

    const cardsByPlayer: (PlayingCard | null)[] = [null, null, null, null];
    for (const play of trick.plays) {
      cardsByPlayer[play.player] = play.card;
    }

    const positions: Array<{ idx: PlayerIndex; cls: string; label: string }> = [
      { idx: 0, cls: "hearts-play-bottom", label: PLAYER_LABELS[0]! },
      { idx: 1, cls: "hearts-play-left", label: PLAYER_LABELS[1]! },
      { idx: 2, cls: "hearts-play-top", label: PLAYER_LABELS[2]! },
      { idx: 3, cls: "hearts-play-right", label: PLAYER_LABELS[3]! },
    ];

    area.innerHTML = positions
      .map(({ idx, cls, label }) => {
        const card = cardsByPlayer[idx];
        const inner = card
          ? renderCard(card, { small: true })
          : `<div class="hearts-play-slot"></div>`;
        return `<div class="hearts-play-cell ${cls}"><div class="hearts-play-name">${label}</div>${inner}</div>`;
      })
      .join("");
  }

  private renderMessage(state: HeartsState): void {
    let msg = state.message;
    if (state.phase === "PASSING") {
      const dir = state.passDirection;
      if (dir === "hold") {
        msg = "Hold round — no passing.";
      } else {
        msg = `Pass 3 cards ${dir} (${this.selectedPass.length}/3 selected).`;
      }
    } else if (state.phase === "PLAYING") {
      if (state.currentTurn === 0) {
        const trickPts =
          state.currentTrick?.plays.reduce(
            (s, p) => s + cardPoints(p.card),
            0,
          ) ?? 0;
        const lead = state.currentTrick?.plays.length === 0;
        msg = lead
          ? "Your turn — lead a card."
          : `Your turn${trickPts > 0 ? ` (${trickPts} pts on table)` : ""}.`;
      } else {
        msg = `${PLAYER_LABELS[state.currentTurn]} is thinking…`;
      }
    } else if (state.phase === "ROUND_OVER") {
      const moon = state.roundResult?.shotTheMoon;
      msg =
        moon !== null && moon !== undefined
          ? `${moon === 0 ? "You" : PLAYER_LABELS[moon]} shot the moon!`
          : "Round complete.";
    } else if (state.phase === "GAME_OVER") {
      msg =
        state.winner === 0
          ? "You won the game!"
          : `${PLAYER_LABELS[state.winner ?? 0]} won the game.`;
    }
    this.$("hearts-message").textContent = msg;
  }

  private renderButtons(state: HeartsState): void {
    const passBtn = this.$("hearts-pass-btn") as HTMLButtonElement;
    const nextBtn = this.$("hearts-next-btn") as HTMLButtonElement;

    if (state.phase === "PASSING" && state.passDirection !== "hold") {
      passBtn.classList.remove("hidden");
      passBtn.disabled = this.selectedPass.length !== 3;
    } else {
      passBtn.classList.add("hidden");
    }

    if (state.phase === "ROUND_OVER") {
      nextBtn.classList.remove("hidden");
      nextBtn.textContent = "Next Round";
    } else if (state.phase === "GAME_OVER") {
      nextBtn.classList.remove("hidden");
      nextBtn.textContent = "Back to Game Room";
    } else {
      nextBtn.classList.add("hidden");
    }
  }
}
