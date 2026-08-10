import type { PlayingCard } from "typedeck";
import {
  createDeck,
  shuffle,
  seededRng,
  randomSeed,
  RANK_DISPLAY,
  SUIT_SYMBOL,
} from "../../shared/deck";
import {
  balance,
  placeWager,
  pushReturn,
  winReturn,
} from "../../shared/engine/betting";
import type { FaroBet, FaroRank, FaroState } from "./types";
import { RANK_COUNT, TURNS_PER_SHOE } from "./types";

export function cardLabel(card: PlayingCard): string {
  return `${RANK_DISPLAY[card.cardName]}${SUIT_SYMBOL[card.suit]}`;
}

export class FaroGame {
  private state!: FaroState;
  private shoe: PlayingCard[] = [];
  private drawn = 0;
  private readonly rng: () => number;

  /** A pre-arranged deck (index 0 drawn first) bypasses the shuffle — for tests. */
  constructor(seed?: number, deck?: PlayingCard[]) {
    this.rng = seededRng(seed ?? randomSeed());
    this.startShoe(deck);
  }

  getState(): Readonly<FaroState> {
    return this.state;
  }

  placeBet(rank: FaroRank, amount: number): boolean {
    if (!this.bettingOpen()) return false;
    const existing = this.state.bets.find((b) => b.rank === rank);
    if (existing === undefined) {
      const wager = placeWager(amount);
      if (wager === null) return this.reject("Not enough chips for that bet.");
      this.state.bets = [...this.state.bets, { rank, wager, coppered: false }];
    } else {
      // One bet per rank: fold the new chips into the existing stake.
      const prev = existing.wager.amount;
      existing.wager.settle(pushReturn(prev));
      const combined = placeWager(prev + amount);
      if (combined === null) {
        existing.wager = placeWager(prev)!;
        return this.reject("Not enough chips for that bet.");
      }
      existing.wager = combined;
    }
    const total = this.state.bets.find((b) => b.rank === rank)!.wager.amount;
    this.state.message = `${total} on ${RANK_DISPLAY[rank]}.`;
    this.refresh();
    return true;
  }

  removeBet(rank: FaroRank): boolean {
    if (!this.bettingOpen()) return false;
    const bet = this.state.bets.find((b) => b.rank === rank);
    if (bet === undefined) return false;
    bet.wager.settle(pushReturn(bet.wager.amount));
    this.state.bets = this.state.bets.filter((b) => b !== bet);
    this.state.message = `Bet on ${RANK_DISPLAY[rank]} taken down.`;
    this.refresh();
    return true;
  }

  toggleCopper(rank: FaroRank): boolean {
    if (!this.bettingOpen()) return false;
    const bet = this.state.bets.find((b) => b.rank === rank);
    if (bet === undefined) return false;
    bet.coppered = !bet.coppered;
    this.state.message = bet.coppered
      ? `${RANK_DISPLAY[rank]} coppered — it now wins with the bank.`
      : `Copper lifted from ${RANK_DISPLAY[rank]}.`;
    this.refresh();
    return true;
  }

  drawTurn(): void {
    if (!this.bettingOpen()) return;

    const bankerCard = this.draw();
    const playerCard = this.draw();
    this.state.caseCounts[bankerCard.cardName]!++;
    this.state.caseCounts[playerCard.cardName]!++;
    const split = bankerCard.cardName === playerCard.cardName;

    const kept: FaroBet[] = [];
    const notes: string[] = [];
    for (const bet of this.state.bets) {
      const label = `${bet.wager.amount} on ${RANK_DISPLAY[bet.rank]}`;
      if (split && bet.rank === bankerCard.cardName) {
        bet.wager.settle(Math.floor(bet.wager.amount / 2));
        notes.push(`split — bank takes half of ${label}`);
      } else if (bet.rank === bankerCard.cardName) {
        if (bet.coppered) {
          bet.wager.settle(winReturn(bet.wager.amount, 1));
          notes.push(`coppered ${label} wins`);
        } else {
          bet.wager.settle(0);
          notes.push(`${label} loses`);
        }
      } else if (bet.rank === playerCard.cardName) {
        if (bet.coppered) {
          bet.wager.settle(0);
          notes.push(`coppered ${label} loses`);
        } else {
          bet.wager.settle(winReturn(bet.wager.amount, 1));
          notes.push(`${label} wins`);
        }
      } else {
        kept.push(bet);
      }
    }
    this.state.bets = kept;
    this.state.lastTurn = { bankerCard, playerCard, split };
    this.state.turnNumber++;

    const heading =
      `Turn ${this.state.turnNumber}/${TURNS_PER_SHOE}: ` +
      `${cardLabel(bankerCard)} loses, ${cardLabel(playerCard)} wins.`;

    if (this.state.turnNumber === TURNS_PER_SHOE) {
      this.state.hock = this.draw();
      for (const bet of this.state.bets) {
        bet.wager.settle(pushReturn(bet.wager.amount));
      }
      if (this.state.bets.length > 0) notes.push("remaining bets returned");
      this.state.bets = [];
      this.state.phase = "SHOE_OVER";
      this.state.message =
        `${heading} Shoe over — hock is ${cardLabel(this.state.hock)}.` +
        (notes.length > 0 ? ` ${notes.join("; ")}.` : "");
    } else {
      this.state.phase = "TURN_RESULT";
      this.state.message =
        heading + (notes.length > 0 ? ` ${notes.join("; ")}.` : "");
    }
    this.refresh();
  }

  newShoe(): void {
    for (const bet of this.state.bets) {
      bet.wager.settle(pushReturn(bet.wager.amount));
    }
    this.startShoe();
  }

  private startShoe(deck?: PlayingCard[]): void {
    this.shoe =
      deck !== undefined ? [...deck] : shuffle(createDeck(), this.rng);
    this.drawn = 0;
    const soda = this.draw();
    const caseCounts = new Array(RANK_COUNT).fill(0);
    caseCounts[soda.cardName]++;
    this.state = {
      phase: "BETTING",
      soda,
      hock: null,
      turnNumber: 0,
      lastTurn: null,
      bets: [],
      caseCounts,
      balance: balance(),
      message: `Soda burned: ${cardLabel(soda)}. Place your bets.`,
      winner: null,
    };
  }

  private bettingOpen(): boolean {
    return this.state.phase === "BETTING" || this.state.phase === "TURN_RESULT";
  }

  private reject(message: string): false {
    this.state.message = message;
    this.refresh();
    return false;
  }

  private refresh(): void {
    this.state.balance = balance();
  }

  private draw(): PlayingCard {
    return this.shoe[this.drawn++]!;
  }
}
