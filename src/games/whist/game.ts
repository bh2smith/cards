import type { Suit } from "typedeck";
import { cardKey, randomSeed, seededRng } from "../../shared/deck";
import { legalPlays, trickWinner } from "../../shared/engine/trick";
import { resolvePreset } from "../../shared/engine/variant";
import { WHIST_FAMILY, type WhistConfig } from "./config";
import {
  type HandType,
  type ModeCtx,
  type PlayerIndex,
  type WhistPhase,
  type WhistState,
  PLAYER_LABELS,
  activeSeats,
  freshState,
  nextActiveSeat,
  partnerOf,
  resetHandState,
  whistRules,
} from "./types";
import {
  type PlayIntent,
  chooseBid,
  chooseDeclaration,
  choosePlay,
  chooseTrumpSuit,
} from "./bot";
import { dealWhist, endWhistHand } from "./modes/whist";
import {
  dealKnockout,
  endKnockoutHand,
  knockoutPickTrump,
} from "./modes/knockout";
import {
  dealOhHell,
  endOhHellHand,
  ohHellBid,
  ohHellForbiddenBid,
} from "./modes/oh-hell";
import {
  dealNorwegian,
  endNorwegianHand,
  norwegianDeclare,
} from "./modes/norwegian";

const ACTING_PHASES = new Set<WhistPhase>([
  "DECLARING",
  "BIDDING",
  "TRUMP_PICK",
  "PLAYING",
]);

export class WhistGame {
  private state: WhistState;
  private readonly cfg: WhistConfig;
  private readonly rng: () => number;
  /** Test hook: when true, botStep also drives seat 0 (the human). */
  autoPilot = false;

  constructor(presetId?: string, seed?: number) {
    this.cfg = resolvePreset(WHIST_FAMILY, presetId);
    this.rng = seededRng(seed ?? randomSeed());
    this.state = freshState(this.cfg);
  }

  getState(): Readonly<WhistState> {
    return this.state;
  }

  getConfig(): Readonly<WhistConfig> {
    return this.cfg;
  }

  private ctx(): ModeCtx {
    return { state: this.state, cfg: this.cfg, rng: this.rng };
  }

  /** Start the next hand (from PRE_DEAL or HAND_OVER). */
  deal(): void {
    const s = this.state;
    if (s.phase !== "PRE_DEAL" && s.phase !== "HAND_OVER") return;
    s.handNumber += 1;
    if (s.handNumber > 1) s.dealer = nextActiveSeat(s, s.dealer);
    s.eldest = nextActiveSeat(s, s.dealer);
    resetHandState(s);
    switch (s.mode) {
      case "whist":
        dealWhist(this.ctx());
        break;
      case "knockout":
        dealKnockout(this.ctx());
        break;
      case "oh-hell":
        dealOhHell(this.ctx());
        break;
      case "norwegian":
        dealNorwegian(this.ctx());
        break;
    }
  }

  /** Start a fresh game from GAME_OVER. */
  newGame(): void {
    if (this.state.phase !== "GAME_OVER") return;
    this.state = freshState(this.cfg);
  }

  // ── Mode-specific actions ─────────────────────────────────────────────────

  declare(seat: PlayerIndex, choice: HandType | "pass"): boolean {
    return norwegianDeclare(this.ctx(), seat, choice);
  }

  bid(seat: PlayerIndex, bid: number): boolean {
    return ohHellBid(this.ctx(), seat, bid);
  }

  pickTrump(seat: PlayerIndex, suit: Suit): boolean {
    return knockoutPickTrump(this.ctx(), seat, suit);
  }

  /** The dealer's forbidden Oh Hell bid for the seat currently bidding. */
  forbiddenBid(): number | null {
    return ohHellForbiddenBid(this.state, this.state.currentTurn);
  }

  // ── Trick play ────────────────────────────────────────────────────────────

  /** Indices in `seat`'s hand that are legal to play right now. */
  legalIndicesFor(seat: PlayerIndex): number[] {
    const s = this.state;
    if (s.phase !== "PLAYING" || s.currentTurn !== seat) return [];
    const hand = s.hands[seat]!;
    const led =
      s.currentTrick && s.currentTrick.plays.length > 0
        ? s.currentTrick.plays[0]!.card
        : null;
    const legal = new Set(
      legalPlays(hand, led, whistRules(s.trump)).map(cardKey),
    );
    const indices: number[] = [];
    hand.forEach((c, i) => {
      if (legal.has(cardKey(c))) indices.push(i);
    });
    return indices;
  }

  humanPlay(index: number): boolean {
    return this.playCard(0, index);
  }

  playCard(seat: PlayerIndex, index: number): boolean {
    const s = this.state;
    if (!this.legalIndicesFor(seat).includes(index)) return false;
    const card = s.hands[seat]!.splice(index, 1)[0]!;
    const trick = s.currentTrick!;
    trick.plays.push({ player: seat, card });

    if (trick.plays.length === activeSeats(s).length) {
      this.completeTrick();
    } else {
      s.currentTurn = nextActiveSeat(s, seat);
    }
    return true;
  }

  private completeTrick(): void {
    const s = this.state;
    const trick = s.currentTrick!;
    const winner = trickWinner(trick.plays, whistRules(s.trump));
    trick.winner = winner;
    s.trickCounts[winner]!++;
    s.completedTricks.push(trick);
    s.lastTrickWinner = winner;

    if (s.completedTricks.length === s.handSize) {
      s.currentTrick = null;
      this.endHand();
      return;
    }
    s.currentTrick = { leader: winner, plays: [], winner: null };
    s.currentTurn = winner;
    s.message = `${winner === 0 ? "You take" : `${PLAYER_LABELS[winner]} takes`} the trick.`;
  }

  private endHand(): void {
    switch (this.state.mode) {
      case "whist":
        endWhistHand(this.ctx());
        break;
      case "knockout":
        endKnockoutHand(this.ctx());
        break;
      case "oh-hell":
        endOhHellHand(this.ctx());
        break;
      case "norwegian":
        endNorwegianHand(this.ctx());
        break;
    }
  }

  // ── Bot driving ───────────────────────────────────────────────────────────

  /**
   * Perform one bot action if a bot (or autoPilot human) is to act.
   * The UI calls this on a timer; returns whether anything happened.
   */
  botStep(): boolean {
    const s = this.state;
    if (!ACTING_PHASES.has(s.phase)) return false;
    const seat = s.currentTurn;
    if (seat === 0 && !this.autoPilot) return false;
    const hand = s.hands[seat]!;

    switch (s.phase) {
      case "DECLARING":
        this.declare(seat, chooseDeclaration(hand));
        break;
      case "BIDDING":
        this.bid(
          seat,
          chooseBid(hand, s.trump, s.handSize, ohHellForbiddenBid(s, seat)),
        );
        break;
      case "TRUMP_PICK":
        this.pickTrump(seat, chooseTrumpSuit(hand));
        break;
      case "PLAYING": {
        const legalIdx = this.legalIndicesFor(seat);
        const legal = legalIdx.map((i) => hand[i]!);
        const card = choosePlay(
          legal,
          s.currentTrick!,
          whistRules(s.trump),
          this.playIntent(seat),
        );
        const index = hand.findIndex((c) => cardKey(c) === cardKey(card));
        this.playCard(seat, index);
        break;
      }
    }
    return true;
  }

  private playIntent(seat: PlayerIndex): PlayIntent {
    const s = this.state;
    switch (s.mode) {
      case "whist":
        return { wantWin: true, partner: partnerOf(seat) };
      case "knockout":
        return { wantWin: true, partner: null };
      case "oh-hell":
        return {
          wantWin: s.trickCounts[seat]! < (s.bids[seat] ?? 0),
          partner: null,
        };
      case "norwegian":
        return {
          wantWin: s.handType === "grand",
          partner: partnerOf(seat),
        };
    }
  }
}
