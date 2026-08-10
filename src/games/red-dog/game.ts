import type { PlayingCard } from "typedeck";
import {
  createDeck,
  shuffle,
  seededRng,
  randomSeed,
  cardOrder,
} from "../../shared/deck";
import {
  balance,
  placeWager,
  winReturn,
  pushReturn,
  type Wager,
} from "../../shared/engine/betting";
import type { RedDogState, RedDogOutcome } from "./types";

export const PAIR_PAYOUT = 11;

/** Rank with aces high: 2 = 2 … K = 13, A = 14. */
export function rankHigh(card: PlayingCard): number {
  const order = cardOrder(card); // A=1 … K=13
  return order === 1 ? 14 : order;
}

/** Count of ranks strictly between two cards (-1 pair, 0 consecutive). */
export function spreadOf(a: PlayingCard, b: PlayingCard): number {
  return Math.abs(rankHigh(a) - rankHigh(b)) - 1;
}

export function payoutForSpread(spread: number): number {
  if (spread === 1) return 5;
  if (spread === 2) return 4;
  if (spread === 3) return 2;
  return 1;
}

export class RedDogGame {
  private state: RedDogState;
  private deck: PlayingCard[] = [];
  private wagers: Wager[] = [];
  private readonly rng: () => number;
  private readonly crafted: PlayingCard[] | null;

  constructor(seed: number = randomSeed(), deck?: PlayingCard[]) {
    this.rng = seededRng(seed);
    this.crafted = deck ? [...deck] : null;
    this.state = this.bettingState();
  }

  getState(): Readonly<RedDogState> {
    return this.state;
  }

  deckCount(): number {
    return this.deck.length;
  }

  private bettingState(): RedDogState {
    return {
      phase: "BETTING",
      card1: null,
      card2: null,
      card3: null,
      bet: 0,
      raised: false,
      spread: null,
      payoutRatio: null,
      outcome: null,
      balance: balance(),
      message: "Place your bet.",
      winner: null,
    };
  }

  canBet(amount: number): boolean {
    return this.state.phase === "BETTING" && amount > 0 && amount <= balance();
  }

  placeBet(amount: number): boolean {
    if (!this.canBet(amount)) return false;
    const wager = placeWager(amount);
    if (!wager) return false;
    this.wagers = [wager];
    this.deck = this.crafted
      ? [...this.crafted]
      : shuffle(createDeck(), this.rng);
    const card1 = this.draw();
    const card2 = this.draw();
    this.state = {
      ...this.state,
      card1,
      card2,
      bet: amount,
      raised: false,
      balance: balance(),
    };

    if (card1.cardName === card2.cardName) {
      this.state.payoutRatio = PAIR_PAYOUT;
      const card3 = this.draw();
      this.state.card3 = card3;
      if (card3.cardName === card1.cardName) {
        this.finish(
          "win",
          winReturn(amount, PAIR_PAYOUT),
          `Three of a kind! Pays 11:1 (+${amount * PAIR_PAYOUT}).`,
        );
      } else {
        this.finish("push", pushReturn(amount), "Pair, no match — push.");
      }
      return true;
    }

    if (spreadOf(card1, card2) === 0) {
      this.finish("push", pushReturn(amount), "Consecutive cards — push.");
      return true;
    }

    const spread = spreadOf(card1, card2);
    const ratio = payoutForSpread(spread);
    this.state = {
      ...this.state,
      phase: "RAISE",
      spread,
      payoutRatio: ratio,
      message: `Spread is ${spread} — pays ${ratio}:1. Raise or deal the third card?`,
    };
    return true;
  }

  canRaise(): boolean {
    return this.state.phase === "RAISE" && balance() >= this.state.bet;
  }

  /** Double the stake, then reveal the third card. */
  raise(): boolean {
    if (!this.canRaise()) return false;
    const extra = placeWager(this.state.bet);
    if (!extra) return false;
    this.wagers.push(extra);
    this.state = {
      ...this.state,
      bet: this.state.bet * 2,
      raised: true,
      balance: balance(),
    };
    this.dealThird();
    return true;
  }

  /** Keep the stake as-is and reveal the third card. */
  call(): boolean {
    if (this.state.phase !== "RAISE") return false;
    this.dealThird();
    return true;
  }

  newRound(): void {
    if (this.state.phase !== "RESULT") return;
    this.state = this.bettingState();
  }

  private dealThird(): void {
    const card3 = this.draw();
    this.state.card3 = card3;
    const v1 = rankHigh(this.state.card1!);
    const v2 = rankHigh(this.state.card2!);
    const lo = Math.min(v1, v2);
    const hi = Math.max(v1, v2);
    const v = rankHigh(card3);
    const stake = this.state.bet;
    const ratio = this.state.payoutRatio!;
    if (v > lo && v < hi) {
      this.finish(
        "win",
        winReturn(stake, ratio),
        `Inside the spread! Pays ${ratio}:1 (+${Math.floor(stake * ratio)}).`,
      );
    } else {
      this.finish("lose", 0, `Outside the spread. You lose ${stake}.`);
    }
  }

  private finish(
    outcome: RedDogOutcome,
    returned: number,
    message: string,
  ): void {
    const [first, ...rest] = this.wagers;
    first?.settle(returned);
    for (const w of rest) w.settle(0);
    this.wagers = [];
    this.state = {
      ...this.state,
      phase: "RESULT",
      outcome,
      balance: balance(),
      message,
      winner:
        outcome === "win" ? "player" : outcome === "lose" ? "computer" : null,
    };
  }

  private draw(): PlayingCard {
    return this.deck.shift()!;
  }
}
