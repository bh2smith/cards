import type { PlayingCard } from "typedeck";
import {
  createDeck,
  shuffle,
  seededRng,
  randomSeed,
  cardOrder,
} from "../../shared/deck";
import { balance, placeWager, winReturn } from "../../shared/engine/betting";
import type { AceyState, AceCall, AceyOutcome } from "./types";

/** Rank with aces high: 2 = 2 … K = 13, A = 14. */
export function rankHigh(card: PlayingCard): number {
  const order = cardOrder(card); // A=1 … K=13
  return order === 1 ? 14 : order;
}

const VALUE_LABELS: Record<number, string> = {
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export function valueLabel(value: number): string {
  if (value === 1) return "A";
  return VALUE_LABELS[value] ?? String(value);
}

export class AceyDeuceyGame {
  private state: AceyState;
  private deck: PlayingCard[] = [];
  private readonly rng: () => number;
  private readonly crafted: PlayingCard[] | null;

  constructor(seed: number = randomSeed(), deck?: PlayingCard[]) {
    this.rng = seededRng(seed);
    this.crafted = deck ? [...deck] : null;
    this.state = this.dealState();
  }

  getState(): Readonly<AceyState> {
    return this.state;
  }

  deckCount(): number {
    return this.deck.length;
  }

  private dealState(): AceyState {
    return {
      phase: "DEAL",
      card1: null,
      card2: null,
      card3: null,
      aceCall: null,
      lo: null,
      hi: null,
      bet: 0,
      lost: 0,
      outcome: null,
      balance: balance(),
      message: "Deal two cards to set the bracket.",
      winner: null,
    };
  }

  deal(): boolean {
    if (this.state.phase !== "DEAL") return false;
    this.deck = this.crafted
      ? [...this.crafted]
      : shuffle(createDeck(), this.rng);
    const card1 = this.draw();
    this.state = { ...this.state, card1, balance: balance() };
    if (cardOrder(card1) === 1) {
      this.state.phase = "CALL_ACE";
      this.state.message = "An ace! Call it high or low.";
      return true;
    }
    this.finishBracket();
    return true;
  }

  callAce(call: AceCall): boolean {
    if (this.state.phase !== "CALL_ACE") return false;
    this.state.aceCall = call;
    this.finishBracket();
    return true;
  }

  canBet(amount: number): boolean {
    return this.state.phase === "BETTING" && amount > 0 && amount <= balance();
  }

  bet(amount: number): boolean {
    if (!this.canBet(amount)) return false;
    const wager = placeWager(amount);
    if (!wager) return false;
    this.state.bet = amount;
    const card3 = this.draw();
    this.state.card3 = card3;

    const post =
      card3.cardName === this.state.card1!.cardName ||
      card3.cardName === this.state.card2!.cardName;
    const v = rankHigh(card3);

    if (post) {
      wager.settle(0);
      const extra = Math.min(amount, balance());
      if (extra > 0) placeWager(extra)!.settle(0);
      this.finish(
        "post",
        `Hit the post! Double loss (−${amount + extra}).`,
        amount + extra,
      );
    } else if (v > this.state.lo! && v < this.state.hi!) {
      wager.settle(winReturn(amount, 1));
      this.finish("win", `In between! You win ${amount}.`, 0);
    } else {
      wager.settle(0);
      this.finish("lose", `Outside the bracket. You lose ${amount}.`, amount);
    }
    return true;
  }

  newRound(): void {
    if (this.state.phase !== "RESULT") return;
    this.state = this.dealState();
  }

  private card1Value(): number {
    const c = this.state.card1!;
    if (cardOrder(c) === 1) return this.state.aceCall === "low" ? 1 : 14;
    return rankHigh(c);
  }

  private finishBracket(): void {
    const card2 = this.draw();
    this.state.card2 = card2;
    const v1 = this.card1Value();
    const v2 = rankHigh(card2);
    if (this.state.card1!.cardName === card2.cardName) {
      this.finish("push", "Matched ranks — push, no bet at risk.", 0);
      return;
    }
    if (Math.abs(v1 - v2) === 1) {
      this.finish("push", "Consecutive cards — push, no bet at risk.", 0);
      return;
    }
    this.state.lo = Math.min(v1, v2);
    this.state.hi = Math.max(v1, v2);
    this.state.phase = "BETTING";
    this.state.message = `Between ${valueLabel(this.state.lo)} and ${valueLabel(this.state.hi)} — place your bet.`;
  }

  private finish(outcome: AceyOutcome, message: string, lost: number): void {
    this.state = {
      ...this.state,
      phase: "RESULT",
      outcome,
      lost,
      balance: balance(),
      message,
      winner:
        outcome === "win" ? "player" : outcome === "push" ? null : "computer",
    };
  }

  private draw(): PlayingCard {
    return this.deck.shift()!;
  }
}
