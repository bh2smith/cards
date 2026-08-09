import { type PlayingCard } from "typedeck";
import { SpadesGame } from "./game";
import { renderCard } from "../../shared/ui/cards";
import { cardKey } from "../../shared/deck";
import {
  type PlayerIndex,
  type SpadesState,
  type TeamHandResult,
  type Trick,
  MAX_BID,
  NIL,
  teamContract,
  teamOf,
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

const BID_DELAY_MS = 700;
const BOT_DELAY_MS = 650;
const TRICK_HOLD_MS = 1050;

const LABELS = ["You", "Left", "Partner", "Right"];
const POS: TablePos[] = ["self", "left", "top", "right"];
const OPPONENTS: PlayerIndex[] = [1, 2, 3];

export class SpadesUI {
  private game: SpadesGame;
  private destroyed = false;
  private animating = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private completedTrickToShow: Trick | null = null;
  private lastTrickCardKey: string | null = null;

  constructor() {
    enterTableMode();
    document.getElementById("app")!.innerHTML = tableLayoutHtml({
      title: "Spades",
      labels: { self: "You", left: "Left", top: "Partner", right: "Right" },
      teams: { self: 0, left: 1, top: 0, right: 1 },
    });
    this.game = new SpadesGame();
    this.bindEvents();
    this.render();
    this.advance();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    exitTableMode();
    document.getElementById("app")!.innerHTML = "";
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("spades"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => {
        location.hash = "/";
      }),
    );
    this.$("tt-hand").addEventListener("click", (e) => this.onHandClick(e));
    this.$("tt-actions").addEventListener("click", (e) =>
      this.onActionClick(e),
    );
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private onHandClick(e: Event): void {
    if (this.animating) return;
    const target = (e.target as HTMLElement).closest(".card") as HTMLElement;
    if (!target) return;
    const index = parseInt(target.dataset.index ?? "-1");
    if (index < 0) return;
    const state = this.game.getState();

    if (state.phase === "PLAYING" && state.currentTurn === 0) {
      const card = state.hands[0]![index];
      if (!card) return;
      if (!this.legalSet().has(cardKey(card))) return;
      this.game.playCard(0, card);
      this.afterAnyPlay();
    }
  }

  private onActionClick(e: Event): void {
    if (this.animating) return;
    const btn = (e.target as HTMLElement).closest("[data-act]") as HTMLElement;
    if (!btn) return;

    switch (btn.dataset.act!) {
      case "bid":
        this.game.placeBid(0, parseInt(btn.dataset.bid!));
        break;
      case "next":
        this.game.nextHand();
        this.completedTrickToShow = null;
        break;
      case "new":
        this.game.newGame();
        this.completedTrickToShow = null;
        break;
      case "home":
        location.hash = "/";
        return;
    }
    this.render();
    this.advance();
  }

  // ── Bot driving ────────────────────────────────────────────────────────────

  private async advance(): Promise<void> {
    if (this.destroyed || this.animating) return;
    const s = this.game.getState();

    if (s.phase === "BIDDING" && s.bidTurn !== 0) {
      this.animating = true;
      await this.delay(BID_DELAY_MS);
      if (this.destroyed) return;
      this.game.botBid();
      this.animating = false;
      this.render();
      this.advance();
      return;
    }

    if (s.phase === "PLAYING" && s.currentTurn !== 0) {
      this.animating = true;
      await this.delay(BOT_DELAY_MS);
      if (this.destroyed) return;
      this.game.botPlay();
      this.animating = false;
      this.afterAnyPlay();
      return;
    }
    // Otherwise it is the human's turn or the hand is over — wait for input.
  }

  private afterAnyPlay(): void {
    const s = this.game.getState();
    const last = s.completedTricks[s.completedTricks.length - 1];
    const nonFinalComplete =
      s.phase === "PLAYING" &&
      s.currentTrick !== null &&
      s.currentTrick.plays.length === 0 &&
      last !== undefined;

    if (nonFinalComplete) {
      this.completedTrickToShow = last!;
      this.render();
      this.holdThenContinue();
    } else {
      this.render();
      this.advance();
    }
  }

  private async holdThenContinue(): Promise<void> {
    this.animating = true;
    await this.delay(TRICK_HOLD_MS);
    if (this.destroyed) return;
    this.animating = false;
    this.completedTrickToShow = null;
    this.render();
    this.advance();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => {
      this.timer = setTimeout(r, ms);
    });
  }

  private legalSet(): Set<string> {
    return new Set(this.game.legalPlaysFor(0).map(cardKey));
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();
    this.renderScoreboard(state);
    this.renderSeatHands(state);
    this.renderFeltBadge(state);
    this.renderTrick(state);
    this.renderPlayerHand(state);
    this.renderMessage(state);
    this.renderActions(state);
  }

  private isActiveSeat(state: SpadesState, seat: PlayerIndex): boolean {
    if (state.phase === "BIDDING") return state.bidTurn === seat;
    if (state.phase === "PLAYING") return state.currentTurn === seat;
    return false;
  }

  private bidChip(state: SpadesState, seat: PlayerIndex): string {
    const bid = state.bids[seat];
    if (bid === null) return "";
    const label = bid === NIL ? "Nil" : String(bid);
    return state.phase === "BIDDING"
      ? `Bid ${label}`
      : `${state.tricksByPlayer[seat]} / ${label}`;
  }

  private renderScoreboard(state: SpadesState): void {
    for (let i = 0 as PlayerIndex; i < 4; i = (i + 1) as PlayerIndex) {
      const pos = POS[i]!;
      this.$(`tt-score-total-${pos}`).textContent = String(
        state.scores[teamOf(i)],
      );
      const nameEl = document.querySelector(
        `#tt-score-${pos} .tt-score-name`,
      ) as HTMLElement;
      nameEl.textContent = LABELS[i] + (state.dealer === i ? " (D)" : "");
      this.$(`tt-score-sub-${pos}`).textContent = this.bidChip(state, i);
      this.$(`tt-score-${pos}`).classList.toggle(
        "tt-active",
        this.isActiveSeat(state, i),
      );
    }
  }

  private renderSeatHands(state: SpadesState): void {
    for (const i of OPPONENTS) {
      const pos = POS[i]!;
      this.$(`tt-seathand-${pos}`).innerHTML = faceDownFanHtml(
        state.hands[i]!.length,
      );
      this.$(`tt-seat-${pos}`).classList.toggle(
        "tt-active",
        this.isActiveSeat(state, i),
      );
    }
  }

  private renderFeltBadge(state: SpadesState): void {
    const broken = state.spadesBroken ? "broken" : "unbroken";
    this.$("tt-felt-badge").innerHTML =
      `<div class="spades-badge"><span class="spades-suit">♠</span>${broken}` +
      ` · bags ${state.bags[0]}–${state.bags[1]}</div>`;
  }

  private renderTrick(state: SpadesState): void {
    const area = this.$("tt-trick");

    if (state.phase === "HAND_OVER" || state.phase === "GAME_OVER") {
      this.lastTrickCardKey = null;
      area.innerHTML = this.summaryHtml(state);
      return;
    }

    let trick: Trick | null;
    if (this.completedTrickToShow) trick = this.completedTrickToShow;
    else if (state.currentTrick && state.currentTrick.plays.length > 0)
      trick = state.currentTrick;
    else trick = null;

    if (!trick) {
      this.lastTrickCardKey = null;
      area.innerHTML = `<div class="tt-trick-empty"></div>`;
      return;
    }

    const byPlayer: (PlayingCard | null)[] = [null, null, null, null];
    for (const play of trick.plays) byPlayer[play.player] = play.card;

    const newest = trick.plays[trick.plays.length - 1];
    const newestKey = newest ? cardKey(newest.card) : null;
    const animateKey =
      newestKey && newestKey !== this.lastTrickCardKey ? newestKey : null;
    this.lastTrickCardKey = newestKey;

    area.innerHTML = POS.map((pos, idx) => {
      const card = byPlayer[idx];
      if (!card) return trickCardHtml(pos, `<div class="tt-trick-slot"></div>`);
      const playIn = cardKey(card) === animateKey;
      return trickCardHtml(pos, renderCard(card, { small: true }), { playIn });
    }).join("");
  }

  private teamSummaryHtml(
    name: string,
    r: TeamHandResult,
    bags: number,
  ): string {
    const nilLines = r.nils
      .map(
        (n) =>
          `<div class="spades-sum-nil">${LABELS[n.player]} nil ${n.made ? "made" : "failed"} ${n.points > 0 ? "+" : ""}${n.points}</div>`,
      )
      .join("");
    const penalty =
      r.bagPenalties > 0
        ? `<div class="spades-sum-nil">Bag penalty −${r.bagPenalties * 100}</div>`
        : "";
    return `
      <div class="spades-sum-team">
        <div class="spades-sum-name">${name}</div>
        <div>Bid ${r.contract} · took ${r.tricks} · ${r.made ? "made" : "set"}
          ${r.bagsAdded > 0 ? ` · +${r.bagsAdded} bag${r.bagsAdded > 1 ? "s" : ""}` : ""}</div>
        ${nilLines}${penalty}
        <div class="spades-sum-total">${r.total >= 0 ? "+" : ""}${r.total} · bags ${bags}</div>
      </div>`;
  }

  private summaryHtml(state: SpadesState): string {
    const result = state.handResult;
    if (!result) return "";
    const title =
      state.phase === "GAME_OVER"
        ? state.winner === 0
          ? "You win!"
          : "Opponents win"
        : "Hand complete";
    return `
      <div class="spades-summary">
        <div class="spades-sum-title">${title}</div>
        ${this.teamSummaryHtml("You & Partner", result.teams[0], state.bags[0])}
        ${this.teamSummaryHtml("Left & Right", result.teams[1], state.bags[1])}
      </div>`;
  }

  private renderPlayerHand(state: SpadesState): void {
    const container = this.$("tt-hand");
    const myPlay = state.phase === "PLAYING" && state.currentTurn === 0;
    const legals = myPlay ? this.legalSet() : new Set<string>();

    container.innerHTML = state.hands[0]!.map((c, idx) =>
      renderCard(c, {
        index: idx,
        dimmed: myPlay && !legals.has(cardKey(c)),
      }),
    ).join("");
    container.style.cursor = myPlay ? "pointer" : "default";
  }

  private renderMessage(state: SpadesState): void {
    let msg = state.message;
    if (state.phase === "BIDDING" && state.bidTurn === 0) {
      msg = "Your bid — how many tricks will you take?";
    } else if (state.phase === "PLAYING" && state.currentTurn === 0) {
      const need = teamContract(state.bids, 0);
      msg = `Your turn — your team has ${state.tricksWon[0]} of ${need}.`;
    }
    this.$("tt-message").textContent = msg;
  }

  private renderActions(state: SpadesState): void {
    const actions = this.$("tt-actions");

    if (state.phase === "BIDDING" && state.bidTurn === 0) {
      let btns = `<button class="tt-btn spades-nil-btn" data-act="bid" data-bid="0" type="button">Nil</button>`;
      for (let n = 1; n <= MAX_BID; n++) {
        btns += `<button class="tt-btn spades-bid-btn" data-act="bid" data-bid="${n}" type="button">${n}</button>`;
      }
      actions.innerHTML = `<div class="spades-bid-grid">${btns}</div>`;
      return;
    }

    if (state.phase === "HAND_OVER") {
      actions.innerHTML = `<button class="tt-btn" data-act="next" type="button">Next Hand</button>`;
      return;
    }
    if (state.phase === "GAME_OVER") {
      actions.innerHTML = `
        <button class="tt-btn" data-act="new" type="button">New Game</button>
        <button class="tt-btn spades-btn-ghost" data-act="home" type="button">Back to Game Room</button>`;
      return;
    }
    actions.innerHTML = "";
  }
}
