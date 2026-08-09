import { type PlayingCard, Suit } from "typedeck";
import { EuchreGame } from "./game";
import { renderCard } from "../../shared/ui/cards";
import { cardKey, SUIT_SYMBOL } from "../../shared/deck";
import {
  type EuchreState,
  type PlayerIndex,
  type Trick,
  suitName,
  teamOf,
} from "./types";
import { EUCHRE_FAMILY } from "./config";
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
import { presetFromHash } from "../../shared/engine/variant";
import { presetChipsHtml } from "../../shared/ui/preset-picker";

const BID_DELAY_MS = 700;
const BOT_DELAY_MS = 650;
const TRICK_HOLD_MS = 1050;

const TEAM_LABELS = ["You", "Left", "Partner", "Right"];
const TEAM_POS: TablePos[] = ["self", "left", "top", "right"];
const CUTTHROAT_LABELS = ["You", "Left", "Right"];
const CUTTHROAT_POS: TablePos[] = ["self", "left", "right"];
const RED_SUITS = new Set<Suit>([Suit.Hearts, Suit.Diamonds]);

export class EuchreUI {
  private game: EuchreGame;
  private destroyed = false;
  private animating = false;
  private reporter = new LeaderboardReporter(GameId.Euchre);
  private completedTrickToShow: Trick | null = null;
  private lastTrickCardKey: string | null = null;
  private aloneSelected = false;
  private presetId: string | undefined;
  private cutthroat: boolean;

  constructor() {
    this.presetId = presetFromHash(location.hash);
    this.game = new EuchreGame(this.presetId);
    this.cutthroat = this.game.getConfig().players === 3;

    const presetName = this.presetId
      ? EUCHRE_FAMILY.presets[this.presetId]?.name
      : undefined;
    const title = presetName ?? "Euchre";

    enterTableMode();
    document.getElementById("app")!.innerHTML = tableLayoutHtml(
      this.cutthroat
        ? {
            title,
            labels: { self: "You", left: "Left", top: "", right: "Right" },
          }
        : {
            title,
            labels: {
              self: "You",
              left: "Left",
              top: "Partner",
              right: "Right",
            },
            teams: { self: 0, left: 1, top: 0, right: 1 },
          },
    );
    document
      .querySelector(".header")!
      .insertAdjacentHTML(
        "afterend",
        presetChipsHtml("euchre", EUCHRE_FAMILY, this.presetId, "Partnership"),
      );
    if (this.cutthroat) {
      this.$("tt-seat-top").style.display = "none";
      this.$("tt-score-top").style.display = "none";
    }
    this.bindEvents();
    this.render();
    this.advance();
  }

  destroy(): void {
    this.destroyed = true;
    exitTableMode();
    document.getElementById("app")!.innerHTML = "";
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private seats(): PlayerIndex[] {
    return this.cutthroat ? [0, 1, 2] : [0, 1, 2, 3];
  }

  private opponents(): PlayerIndex[] {
    return this.cutthroat ? [1, 2] : [1, 2, 3];
  }

  private posOf(seat: PlayerIndex): TablePos {
    return (this.cutthroat ? CUTTHROAT_POS : TEAM_POS)[seat]!;
  }

  private labelOf(seat: PlayerIndex): string {
    return (this.cutthroat ? CUTTHROAT_LABELS : TEAM_LABELS)[seat]!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("euchre"),
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

    if (state.phase === "DISCARD" && state.dealer === 0) {
      const card = state.hands[0]![index];
      if (!card) return;
      this.game.discard(0, card);
      this.render();
      this.advance();
      return;
    }

    // Railroad: the loner sheds the sixth card after the partner's exchange.
    if (state.phase === "ALONE_DISCARD") {
      const card = state.hands[0]![index];
      if (!card) return;
      this.game.aloneDiscard(card);
      this.render();
      this.advance();
      return;
    }

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
    const act = btn.dataset.act!;
    const state = this.game.getState();

    switch (act) {
      case "order":
        this.game.orderUp(0, false);
        break;
      case "order-alone":
        this.game.orderUp(0, true);
        break;
      case "name": {
        const suit = parseInt(btn.dataset.suit!) as Suit;
        this.game.nameTrump(0, suit, this.aloneSelected);
        this.aloneSelected = false;
        break;
      }
      case "toggle-alone":
        this.aloneSelected = !this.aloneSelected;
        this.render();
        return;
      case "pass":
        this.game.pass(0);
        break;
      case "next":
        if (state.phase === "GAME_OVER") {
          location.hash = "/";
          return;
        }
        this.game.nextHand();
        this.completedTrickToShow = null;
        this.aloneSelected = false;
        break;
    }
    this.render();
    this.advance();
  }

  // ── Bot driving ────────────────────────────────────────────────────────────

  private async advance(): Promise<void> {
    if (this.destroyed || this.animating) return;
    const s = this.game.getState();

    if ((s.phase === "BID1" || s.phase === "BID2") && s.bidTurn !== 0) {
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
    // Otherwise it is the human's turn (bid / discard / play) or the hand is
    // over — stop and wait for input.
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
    return new Promise((r) => setTimeout(r, ms));
  }

  private legalSet(): Set<string> {
    return new Set(this.game.legalPlaysFor(0).map(cardKey));
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();
    this.reporter.reportVsAi(state.phase, state.winner === 0);

    this.renderScoreboard(state);
    this.renderSeatHands(state);
    this.renderFeltBadge(state);
    this.renderTrick(state);
    this.renderPlayerHand(state);
    this.renderMessage(state);
    this.renderActions(state);
  }

  private isActiveSeat(state: EuchreState, seat: PlayerIndex): boolean {
    if (state.phase === "BID1" || state.phase === "BID2")
      return state.bidTurn === seat;
    if (state.phase === "PLAYING") return state.currentTurn === seat;
    return false;
  }

  private scoreOf(state: EuchreState, seat: PlayerIndex): number {
    const scores: readonly number[] = state.scores;
    return this.cutthroat ? scores[seat]! : scores[teamOf(seat)]!;
  }

  private renderScoreboard(state: EuchreState): void {
    for (const i of this.seats()) {
      const pos = this.posOf(i);
      this.$(`tt-score-total-${pos}`).textContent = String(
        this.scoreOf(state, i),
      );
      const nameEl = document.querySelector(
        `#tt-score-${pos} .tt-score-name`,
      ) as HTMLElement;
      const marks =
        (state.maker === i ? " ★" : "") + (state.dealer === i ? " (D)" : "");
      nameEl.textContent = this.labelOf(i) + marks;

      const tricks = state.completedTricks.filter((t) => t.winner === i).length;
      this.$(`tt-score-sub-${pos}`).textContent =
        state.phase === "PLAYING" || state.phase === "HAND_OVER"
          ? "●".repeat(tricks)
          : "";

      this.$(`tt-score-${pos}`).classList.toggle(
        "tt-active",
        this.isActiveSeat(state, i),
      );
    }
  }

  private renderSeatHands(state: EuchreState): void {
    for (const i of this.opponents()) {
      const pos = this.posOf(i);
      this.$(`tt-seathand-${pos}`).innerHTML = faceDownFanHtml(
        state.hands[i]!.length,
      );
      const seat = this.$(`tt-seat-${pos}`);
      seat.classList.toggle("tt-active", this.isActiveSeat(state, i));
      seat.classList.toggle("tt-out", state.aloneSitter === i);
    }
  }

  private renderFeltBadge(state: EuchreState): void {
    const badge = this.$("tt-felt-badge");
    if (state.trump !== null && state.phase !== "BID1") {
      const red = RED_SUITS.has(state.trump);
      badge.innerHTML = `<div class="eu-trump">Trump<span class="eu-suit ${red ? "red" : "black"}">${SUIT_SYMBOL[state.trump]}</span></div>`;
    } else {
      badge.innerHTML = "";
    }
  }

  private renderTrick(state: EuchreState): void {
    const area = this.$("tt-trick");

    // The turned-up card during bidding.
    if (
      (state.phase === "BID1" || state.phase === "BID2") &&
      state.upCard !== null
    ) {
      this.lastTrickCardKey = null;
      const faceDown = state.phase === "BID2";
      const label = faceDown ? "Turned down" : "Turn-up";
      const card = faceDown
        ? `<div class="card face-down"></div>`
        : renderCard(state.upCard, { small: false });
      area.innerHTML = `<div class="eu-upcard">${card}<span class="eu-upcard-label">${label}</span></div>`;
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

    area.innerHTML = this.seats()
      .map((idx) => {
        const pos = this.posOf(idx);
        const card = byPlayer[idx];
        if (!card) {
          // Don't draw an empty slot for a loner's sitting-out partner.
          if (state.aloneSitter === idx) return "";
          return trickCardHtml(pos, `<div class="tt-trick-slot"></div>`);
        }
        const playIn = cardKey(card) === animateKey;
        return trickCardHtml(pos, renderCard(card, { small: true }), {
          playIn,
        });
      })
      .join("");
  }

  private renderPlayerHand(state: EuchreState): void {
    const container = this.$("tt-hand");
    const hand = state.hands[0]!;

    const discarding =
      (state.phase === "DISCARD" && state.dealer === 0) ||
      state.phase === "ALONE_DISCARD";
    const myPlay = state.phase === "PLAYING" && state.currentTurn === 0;
    const sittingOut = state.aloneSitter === 0;

    let legals = new Set<string>();
    if (myPlay) legals = this.legalSet();

    container.innerHTML = hand
      .map((c, idx) =>
        renderCard(c, {
          index: idx,
          dimmed: (myPlay && !legals.has(cardKey(c))) || sittingOut,
        }),
      )
      .join("");
    container.style.cursor = discarding || myPlay ? "pointer" : "default";
    container.classList.toggle("eu-hand-out", sittingOut);
  }

  private renderMessage(state: EuchreState): void {
    let msg = state.message;
    if (state.aloneSitter === 0 && state.phase === "PLAYING") {
      msg = "Your partner is going alone — sit this hand out.";
    } else if (state.phase === "PLAYING" && state.currentTurn === 0) {
      msg = `Your turn — ${suitName(state.trump!)} is trump.`;
    } else if (state.phase === "DISCARD" && state.dealer === 0) {
      msg = "You picked it up — tap a card to discard.";
    } else if (state.phase === "ALONE_DISCARD") {
      msg = "Partner passed you their best card — tap one to discard.";
    } else if (state.phase === "BID1" && state.bidTurn === 0) {
      msg = `Order up ${suitName(state.upCard!.suit)}, or pass?`;
    } else if (state.phase === "BID2" && state.bidTurn === 0) {
      msg = "Name a suit for trump, or pass.";
    }
    this.$("tt-message").textContent = msg;
  }

  private renderActions(state: EuchreState): void {
    const actions = this.$("tt-actions");

    if (state.phase === "BID1" && state.bidTurn === 0) {
      const orderLabel = state.dealer === 0 ? "Pick It Up" : "Order Up";
      const aloneBtn = this.cutthroat
        ? ""
        : `<button class="tt-btn eu-btn-alt" data-act="order-alone" type="button">Alone</button>`;
      actions.innerHTML = `
        <button class="tt-btn" data-act="order" type="button">${orderLabel}</button>
        ${aloneBtn}
        <button class="tt-btn eu-btn-ghost" data-act="pass" type="button">Pass</button>`;
      return;
    }

    if (state.phase === "BID2" && state.bidTurn === 0) {
      const suits = [
        Suit.Spades,
        Suit.Hearts,
        Suit.Clubs,
        Suit.Diamonds,
      ].filter((s) => s !== state.turnedDownSuit);
      const suitBtns = suits
        .map((s) => {
          const red = RED_SUITS.has(s);
          return `<button class="tt-btn eu-suit-btn ${red ? "red" : "black"}" data-act="name" data-suit="${s}" type="button">${SUIT_SYMBOL[s]}</button>`;
        })
        .join("");
      const aloneCls = this.aloneSelected ? "eu-toggle on" : "eu-toggle";
      const aloneBtn = this.cutthroat
        ? ""
        : `<button class="${aloneCls}" data-act="toggle-alone" type="button">Alone</button>`;
      const pass = this.game.canPass(0)
        ? `<button class="tt-btn eu-btn-ghost" data-act="pass" type="button">Pass</button>`
        : "";
      actions.innerHTML = `
        ${aloneBtn}
        ${suitBtns}
        ${pass}`;
      return;
    }

    if (state.phase === "HAND_OVER") {
      actions.innerHTML = `<button class="tt-btn" data-act="next" type="button">Next Hand</button>`;
      return;
    }
    if (state.phase === "GAME_OVER") {
      actions.innerHTML = `<button class="tt-btn" data-act="next" type="button">Back to Game Room</button>`;
      return;
    }
    actions.innerHTML = "";
  }
}
