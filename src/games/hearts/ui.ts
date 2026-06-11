import { type PlayingCard } from "typedeck";
import { HeartsGame } from "./game";
import { renderCard } from "../../shared/ui/cards";
import { cardKey } from "../../shared/deck";
import {
  type HeartsState,
  type PlayerIndex,
  type Trick,
  cardPoints,
} from "./types";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";
import {
  type TablePos,
  tableLayoutHtml,
  trickCardHtml,
  faceDownFanHtml,
  enterTableMode,
  exitTableMode,
} from "../../shared/ui/table-layout";
import { LeaderboardReporter, GameId } from "../../shared/circles/leaderboard";

const BOT_DELAY_MS = 600;
const TRICK_HOLD_MS = 1100;

const PLAYER_LABELS = ["You", "Left", "Top", "Right"];

// player index → compass position on the table
const POS: TablePos[] = ["self", "left", "top", "right"];
const OPPONENTS: PlayerIndex[] = [1, 2, 3];

export class HeartsUI {
  private game: HeartsGame;
  private destroyed = false;
  private animating = false;
  private reporter = new LeaderboardReporter(GameId.Hearts);
  private selectedPass: number[] = [];
  private completedTrickToShow: Trick | null = null;
  private lastTrickCardKey: string | null = null;

  constructor() {
    enterTableMode();
    document.getElementById("app")!.innerHTML = tableLayoutHtml({
      title: "Hearts",
      labels: { self: "You", left: "Left", top: "Top", right: "Right" },
    });
    this.game = new HeartsGame();
    this.bindEvents();
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    exitTableMode();
    document.getElementById("app")!.innerHTML = "";
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("hearts"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => {
        location.hash = "/";
      }),
    );
    this.$("tt-hand").addEventListener("click", (e) => this.onHandClick(e));
    this.$("tt-actions").addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("button");
      if (!btn) return;
      if (btn.id === "tt-pass-btn") this.onPass();
      else if (btn.id === "tt-next-btn") this.onNext();
    });
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

    this.reporter.reportVsAi(state.phase, state.winner === 0);

    this.renderScoreboard(state);
    this.renderSeatHands(state);
    this.renderPlayerHand(state);
    this.renderTrick(state);
    this.renderMessage(state);
    this.renderButtons(state);
  }

  private renderScoreboard(state: HeartsState): void {
    for (let i = 0; i < 4; i++) {
      const pos = POS[i]!;
      this.$(`tt-score-total-${pos}`).textContent = String(state.scores[i]);
      const round =
        state.roundResult?.pointsByPlayer[i] ?? state.roundScores[i] ?? 0;
      this.$(`tt-score-sub-${pos}`).textContent = round > 0 ? `+${round}` : "";
      const active = state.phase === "PLAYING" && state.currentTurn === i;
      this.$(`tt-score-${pos}`).classList.toggle("tt-active", active);
    }
  }

  private renderSeatHands(state: HeartsState): void {
    for (const i of OPPONENTS) {
      const pos = POS[i]!;
      const container = this.$(`tt-seathand-${pos}`);
      container.innerHTML = faceDownFanHtml(state.hands[i]!.length);
      const active = state.phase === "PLAYING" && state.currentTurn === i;
      this.$(`tt-seat-${pos}`).classList.toggle("tt-active", active);
    }
  }

  private renderPlayerHand(state: HeartsState): void {
    const container = this.$("tt-hand");
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

  private renderTrick(state: HeartsState): void {
    const area = this.$("tt-trick");
    let trick: Trick | null;
    if (this.completedTrickToShow) {
      trick = this.completedTrickToShow;
    } else if (state.currentTrick && state.currentTrick.plays.length > 0) {
      trick = state.currentTrick;
    } else {
      trick = null;
    }

    if (!trick) {
      this.lastTrickCardKey = null;
      const hint = state.phase === "PASSING" ? "Select 3 cards to pass" : "";
      area.innerHTML = `<div class="tt-trick-empty">${hint}</div>`;
      return;
    }

    const cardsByPlayer: (PlayingCard | null)[] = [null, null, null, null];
    for (const play of trick.plays) {
      cardsByPlayer[play.player] = play.card;
    }

    // Animate only the most-recently played card, and only once.
    const newest = trick.plays[trick.plays.length - 1];
    const newestKey = newest ? cardKey(newest.card) : null;
    const animateKey =
      newestKey && newestKey !== this.lastTrickCardKey ? newestKey : null;
    this.lastTrickCardKey = newestKey;

    area.innerHTML = POS.map((pos, idx) => {
      const card = cardsByPlayer[idx];
      if (!card) {
        return trickCardHtml(pos, `<div class="tt-trick-slot"></div>`);
      }
      const playIn = cardKey(card) === animateKey;
      return trickCardHtml(pos, renderCard(card, { small: true }), { playIn });
    }).join("");
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
    this.$("tt-message").textContent = msg;
  }

  private renderButtons(state: HeartsState): void {
    const actions = this.$("tt-actions");
    if (state.phase === "PASSING" && state.passDirection !== "hold") {
      const disabled = this.selectedPass.length !== 3 ? "disabled" : "";
      actions.innerHTML = `<button id="tt-pass-btn" class="tt-btn" type="button" ${disabled}>Pass 3 Cards</button>`;
    } else if (state.phase === "ROUND_OVER") {
      actions.innerHTML = `<button id="tt-next-btn" class="tt-btn" type="button">Next Round</button>`;
    } else if (state.phase === "GAME_OVER") {
      actions.innerHTML = `<button id="tt-next-btn" class="tt-btn" type="button">Back to Game Room</button>`;
    } else {
      actions.innerHTML = "";
    }
  }
}
