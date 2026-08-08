import { randomSeed, seededRng } from "../../shared/deck";
import { adjustBankroll } from "../../shared/engine/bankroll";
import { resolvePreset } from "../../shared/engine/variant";
import { MICHIGAN_FAMILY, type MichiganConfig } from "./config";
import {
  type MichiganState,
  type ModeCtx,
  type PlayerIndex,
  PLAYER_LABELS,
  emptyRows,
  freshState,
  nextSeat,
} from "./types";
import {
  dealMichigan,
  michiganBotAct,
  michiganLeadIndices,
  michiganPlay,
  requiredIndexMich,
  resolveDealerSwap,
  shouldBotSwap,
} from "./modes/michigan";
import {
  dealFanTan,
  fanTanBotAct,
  fanTanLegalIndices,
  fanTanPass,
  fanTanPlay,
} from "./modes/fan-tan";
import {
  dealPlayOrPay,
  popBotAct,
  popLeadIndices,
  popPay,
  popPlay,
  popRequiredIndex,
} from "./modes/play-or-pay";

const ACTING_PHASES = new Set(["AWAIT_LEAD", "AWAIT_PLAY", "AWAIT_FORCED"]);

export class MichiganGame {
  private state: MichiganState;
  private readonly cfg: MichiganConfig;
  private readonly rng: () => number;
  /** Test hook: when true, botStep also drives seat 0 (the human). */
  autoPilot = false;

  constructor(presetId?: string, seed?: number) {
    this.cfg = resolvePreset(MICHIGAN_FAMILY, presetId);
    this.rng = seededRng(seed ?? randomSeed());
    this.state = freshState(this.cfg);
  }

  getState(): Readonly<MichiganState> {
    return this.state;
  }

  getConfig(): Readonly<MichiganConfig> {
    return this.cfg;
  }

  private ctx(): ModeCtx {
    return {
      state: this.state,
      cfg: this.cfg,
      rng: this.rng,
      endHand: (w) => this.endHand(w),
    };
  }

  /** Start the next hand (from PRE_DEAL or HAND_OVER). */
  deal(): void {
    const s = this.state;
    if (s.phase !== "PRE_DEAL" && s.phase !== "HAND_OVER") return;
    s.handNumber += 1;
    if (s.handNumber > 1) s.dealer = nextSeat(s.dealer);
    s.handWinner = null;
    s.sequence = null;
    s.prevSuit = null;
    s.played = [];
    s.rows = emptyRows();
    s.startedSuits = [];
    s.deadHand = [];

    switch (s.mode) {
      case "michigan":
        dealMichigan(this.ctx());
        if (s.dealer !== 0 || this.autoPilot) {
          resolveDealerSwap(this.ctx(), shouldBotSwap(s.hands[s.dealer]!));
        }
        break;
      case "fan-tan":
        dealFanTan(this.ctx());
        break;
      case "play-or-pay":
        dealPlayOrPay(this.ctx());
        break;
    }
  }

  /** Human dealer's widow decision (Michigan only). */
  dealerSwap(swap: boolean): void {
    const s = this.state;
    if (s.phase !== "DEALER_SWAP" || s.dealer !== 0) return;
    resolveDealerSwap(this.ctx(), swap);
  }

  /** Indices in `seat`'s hand that are clickable right now. */
  legalIndicesFor(seat: PlayerIndex): number[] {
    const s = this.state;
    if (s.currentTurn !== seat) return [];
    switch (s.mode) {
      case "michigan": {
        if (s.phase === "AWAIT_LEAD") return michiganLeadIndices(s, seat);
        if (s.phase === "AWAIT_PLAY") {
          const i = requiredIndexMich(s, seat);
          return i >= 0 ? [i] : [];
        }
        return [];
      }
      case "fan-tan":
        return s.phase === "AWAIT_PLAY" ? fanTanLegalIndices(s, seat) : [];
      case "play-or-pay": {
        if (s.phase === "AWAIT_LEAD") return popLeadIndices(s, seat);
        if (s.phase === "AWAIT_FORCED") {
          const i = popRequiredIndex(s, seat);
          return i >= 0 ? [i] : [];
        }
        return [];
      }
    }
  }

  humanPlay(index: number): boolean {
    return this.playFor(0, index);
  }

  private playFor(seat: PlayerIndex, index: number): boolean {
    switch (this.state.mode) {
      case "michigan":
        return michiganPlay(this.ctx(), seat, index);
      case "fan-tan":
        return fanTanPlay(this.ctx(), seat, index);
      case "play-or-pay":
        return popPlay(this.ctx(), seat, index);
    }
  }

  /** Whether the human's only move is to pay a chip and pass. */
  humanMustPass(): boolean {
    const s = this.state;
    if (s.currentTurn !== 0) return false;
    if (s.mode === "fan-tan") {
      return s.phase === "AWAIT_PLAY" && fanTanLegalIndices(s, 0).length === 0;
    }
    if (s.mode === "play-or-pay") {
      return s.phase === "AWAIT_FORCED" && popRequiredIndex(s, 0) < 0;
    }
    return false;
  }

  humanPass(): boolean {
    switch (this.state.mode) {
      case "fan-tan":
        return fanTanPass(this.ctx(), 0);
      case "play-or-pay":
        return popPay(this.ctx(), 0);
      default:
        return false;
    }
  }

  /**
   * Perform one bot action if it is a bot's move (or autoPilot is on).
   * The UI calls this on a timer; returns whether anything happened.
   */
  botStep(): boolean {
    const s = this.state;
    if (s.phase === "DEALER_SWAP") {
      if (s.dealer === 0 && !this.autoPilot) return false;
      resolveDealerSwap(this.ctx(), shouldBotSwap(s.hands[s.dealer]!));
      return true;
    }
    if (!ACTING_PHASES.has(s.phase)) return false;
    const seat = s.currentTurn;
    if (seat === 0 && !this.autoPilot) return false;
    switch (s.mode) {
      case "michigan":
        michiganBotAct(this.ctx(), seat);
        break;
      case "fan-tan":
        fanTanBotAct(this.ctx(), seat);
        break;
      case "play-or-pay":
        popBotAct(this.ctx(), seat);
        break;
    }
    return true;
  }

  /** Start a fresh session from GAME_OVER. */
  newSession(): void {
    if (this.state.phase !== "GAME_OVER") return;
    this.state = freshState(this.cfg);
  }

  private endHand(winner: PlayerIndex): void {
    const s = this.state;
    s.handWinner = winner;
    s.sequence = null;

    let gained = s.pot;
    s.chips[winner]! += s.pot;
    s.pot = 0;
    for (let p = 0; p < 4; p++) {
      if (p === winner) continue;
      const due = s.hands[p]!.length;
      s.chips[p]! -= due;
      s.chips[winner]! += due;
      gained += due;
    }

    if (s.handNumber >= this.cfg.handsPerGame) {
      this.finishSession(winner, gained);
      return;
    }
    s.phase = "HAND_OVER";
    s.message = `${PLAYER_LABELS[winner]} went out and collect${winner === 0 ? "" : "s"} ${gained} chips.`;
  }

  private finishSession(handWinner: PlayerIndex, gained: number): void {
    const s = this.state;
    s.phase = "GAME_OVER";
    const bestBot = Math.max(s.chips[1]!, s.chips[2]!, s.chips[3]!);
    s.winner = s.chips[0]! >= bestBot ? "player" : "computer";
    s.sessionNet = s.chips[0]! - this.cfg.startingChips;
    adjustBankroll(s.sessionNet);

    const leader = s.chips.indexOf(Math.max(...s.chips)) as PlayerIndex;
    const outcome =
      s.winner === "player"
        ? `You lead the table with ${s.chips[0]} chips`
        : `${PLAYER_LABELS[leader]} leads with ${s.chips[leader]} chips`;
    const net = s.sessionNet >= 0 ? `+${s.sessionNet}` : String(s.sessionNet);
    s.message = `${PLAYER_LABELS[handWinner]} went out for ${gained} chips. ${outcome} — ${net} to your bankroll.`;
  }
}
