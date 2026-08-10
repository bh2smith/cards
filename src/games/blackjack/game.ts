import type { PlayingCard } from "typedeck";
import { createDeck, shuffle, cardOrder } from "../../shared/deck";
import type { BlackjackState, RoundResult } from "./types";
import { WIN_TARGET } from "./types";
import {
  balance,
  placeWager,
  winReturn,
  pushReturn,
  type Wager,
} from "../../shared/engine/betting";
import { resolvePreset } from "../../shared/engine/variant";
import {
  BLACKJACK_FAMILY,
  doubleAllowed,
  type BlackjackConfig,
} from "./config";

/** Multi-deck shoes reshuffle before a round that starts below this depth. */
const RESHUFFLE_BELOW = 15;

export function handValue(cards: PlayingCard[]): number {
  let value = 0;
  let aces = 0;
  for (const card of cards) {
    const order = cardOrder(card); // A=1, 2=2, ..., K=13
    if (order === 1) {
      aces++;
      value += 11;
    } else if (order >= 10) {
      value += 10;
    } else {
      value += order;
    }
  }
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  return value;
}

export function isBust(cards: PlayingCard[]): boolean {
  return handValue(cards) > 21;
}

export function isBlackjack(cards: PlayingCard[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

export function isSoft(cards: PlayingCard[]): boolean {
  let value = 0;
  let aces = 0;
  for (const card of cards) {
    const order = cardOrder(card);
    if (order === 1) {
      aces++;
      value += 11;
    } else if (order >= 10) {
      value += 10;
    } else {
      value += order;
    }
  }
  let softAces = aces;
  while (value > 21 && softAces > 0) {
    value -= 10;
    softAces--;
  }
  return softAces > 0;
}

export function shouldDealerHit(
  cards: PlayingCard[],
  hitsSoft17 = true,
): boolean {
  const value = handValue(cards);
  return value < 17 || (value === 17 && hitsSoft17 && isSoft(cards));
}

export class BlackjackGame {
  private state: BlackjackState;
  private deck: PlayingCard[] = [];
  private readonly config: BlackjackConfig;
  // Active house wagers per hand: index 0 the original bet, a double
  // appends a second equal wager. Settled (and cleared) at round end.
  private handWagers: [Wager[], Wager[]] = [[], []];

  constructor(presetId?: string) {
    this.config = resolvePreset(BLACKJACK_FAMILY, presetId);
    this.deck = this.buildShoe();
    this.state = this.bettingState();
  }

  getConfig(): BlackjackConfig {
    return this.config;
  }

  private bettingState(): BlackjackState {
    return {
      phase: "BETTING",
      playerHand: [],
      splitHand: null,
      splitBet: 0,
      activeHand: 0,
      dealerHand: [],
      holeRevealed: false,
      chips: balance(),
      bet: 0,
      shoeDepth: this.deck.length,
      roundResult: null,
      splitResult: null,
      message: "Place your bet.",
      winner: null,
    };
  }

  getState(): Readonly<BlackjackState> {
    return this.state;
  }

  canBet(amount: number): boolean {
    return this.state.phase === "BETTING" && amount > 0 && amount <= balance();
  }

  placeBet(amount: number): void {
    if (!this.canBet(amount)) return;
    const wager = placeWager(amount);
    if (wager === null) return;
    this.handWagers = [[wager], []];
    this.prepareShoe();

    const playerHand = [this.draw(), this.draw()];
    const dealerHand = [this.draw(), this.draw()];
    const playerBJ = isBlackjack(playerHand);

    this.state = {
      ...this.state,
      phase: playerBJ ? "DEALER_TURN" : "PLAYER_TURN",
      playerHand,
      splitHand: null,
      splitBet: 0,
      activeHand: 0,
      dealerHand,
      holeRevealed: false,
      chips: balance(),
      bet: amount,
      shoeDepth: this.deck.length,
      roundResult: null,
      splitResult: null,
      message: playerBJ ? "Blackjack!" : "Hit or stand?",
      winner: null,
    };
  }

  canSplit(): boolean {
    return (
      this.state.phase === "PLAYER_TURN" &&
      this.state.activeHand === 0 &&
      // One split max: config.resplit is false in every preset, and the
      // two-hand data model couldn't hold a re-split hand anyway.
      this.state.splitHand === null &&
      this.state.playerHand.length === 2 &&
      cardOrder(this.state.playerHand[0]!) ===
        cardOrder(this.state.playerHand[1]!) &&
      balance() >= this.state.bet
    );
  }

  split(): void {
    if (!this.canSplit()) return;
    const wager = placeWager(this.state.bet);
    if (wager === null) return;
    this.handWagers[1] = [wager];
    const [c0, c1] = this.state.playerHand;
    this.state.splitBet = this.state.bet;
    this.state.playerHand = [c0!, this.draw()];
    this.state.splitHand = [c1!, this.draw()];
    this.state.activeHand = 0;
    this.state.chips = balance();
    this.state.roundResult = null;
    this.state.splitResult = null;
    this.state.message = "Playing first hand — Hit or Stand?";

    if (isBlackjack(this.state.playerHand)) {
      this.onHandComplete();
    }
  }

  canDoubleDown(): boolean {
    if (this.state.phase !== "PLAYER_TURN") return false;
    const hand = this.activeHandCards();
    const bet = this.activeBet();
    return (
      hand.length === 2 &&
      doubleAllowed(this.config.doubleOn, handValue(hand)) &&
      balance() >= bet
    );
  }

  doubleDown(): void {
    if (!this.canDoubleDown()) return;
    const bet = this.activeBet();
    const wager = placeWager(bet);
    if (wager === null) return;
    this.handWagers[this.state.activeHand].push(wager);
    if (this.state.activeHand === 0) {
      this.state.bet *= 2;
    } else {
      this.state.splitBet *= 2;
    }
    this.state.chips = balance();
    const newHand = [...this.activeHandCards(), this.draw()];
    this.setActiveHandCards(newHand);
    if (isBust(newHand)) {
      this.markCurrentHandBust();
    }
    this.onHandComplete();
  }

  canSurrender(): boolean {
    return (
      this.config.surrender &&
      this.state.phase === "PLAYER_TURN" &&
      // First two cards only, never after a split.
      this.state.splitHand === null &&
      this.state.playerHand.length === 2 &&
      // Late surrender: the dealer checks for blackjack first.
      !isBlackjack(this.state.dealerHand)
    );
  }

  /** Late surrender: forfeit half the bet (floored refund), round over. */
  surrender(): void {
    if (!this.canSurrender()) return;
    const refund = Math.floor(this.state.bet / 2);
    this.settleWagers(0, refund);
    this.state = {
      ...this.state,
      phase: "ROUND_OVER",
      holeRevealed: true,
      roundResult: "surrender",
      chips: balance(),
      message: `Surrendered — ${refund} of ${this.state.bet} returned.`,
      winner: "computer",
    };
  }

  hit(): void {
    if (this.state.phase !== "PLAYER_TURN") return;
    const hand = this.activeHandCards();
    if (isBlackjack(hand)) return;
    const newHand = [...hand, this.draw()];
    this.setActiveHandCards(newHand);
    if (isBust(newHand)) {
      this.markCurrentHandBust();
      this.onHandComplete();
    } else {
      this.state.message = "Hit or stand?";
    }
  }

  stand(): void {
    if (this.state.phase !== "PLAYER_TURN") return;
    this.onHandComplete();
  }

  beginDealerTurn(): void {
    if (
      this.state.phase !== "PLAYER_TURN" &&
      this.state.phase !== "DEALER_TURN"
    )
      return;
    this.state.phase = "DEALER_TURN";
    this.state.holeRevealed = true;
    this.state.message = "Dealer's turn…";
  }

  dealerDrawOne(): boolean {
    if (this.state.phase !== "DEALER_TURN") return false;
    if (!shouldDealerHit(this.state.dealerHand, this.config.dealerHitsSoft17))
      return false;
    this.state.dealerHand = [...this.state.dealerHand, this.draw()];
    return true;
  }

  settleRound(): void {
    if (this.state.phase !== "DEALER_TURN") return;

    const dealerVal = handValue(this.state.dealerHand);
    const dealerBust = isBust(this.state.dealerHand);
    const dealerBJ = isBlackjack(this.state.dealerHand);

    const settle = (
      hand: PlayingCard[],
      bet: number,
      priorResult: RoundResult | null,
    ): { result: RoundResult; payout: number } => {
      if (priorResult === "bust") return { result: "bust", payout: 0 };
      const playerVal = handValue(hand);
      if (isBlackjack(hand) && !dealerBJ) {
        return {
          result: "blackjack",
          payout: winReturn(bet, this.config.blackjackPays),
        };
      } else if (dealerBust || playerVal > dealerVal) {
        return { result: "win", payout: winReturn(bet, 1) };
      } else if (playerVal === dealerVal) {
        return { result: "push", payout: pushReturn(bet) };
      } else {
        return { result: "lose", payout: 0 };
      }
    };

    const h0 = settle(
      this.state.playerHand,
      this.state.bet,
      this.state.roundResult,
    );
    const h1 =
      this.state.splitHand !== null
        ? settle(
            this.state.splitHand,
            this.state.splitBet,
            this.state.splitResult,
          )
        : null;

    this.settleWagers(0, h0.payout);
    if (h1 !== null) this.settleWagers(1, h1.payout);

    const msg = (r: RoundResult, val: number, bet: number): string => {
      switch (r) {
        case "blackjack":
          return `Blackjack! (+${Math.floor(bet * 1.5)})`;
        case "win":
          return dealerBust
            ? `Win — dealer busts (+${bet})`
            : `Win ${val} > ${dealerVal} (+${bet})`;
        case "push":
          return `Push`;
        case "lose":
          return `Lose — ${dealerVal} > ${val}`;
        case "bust":
          return `Bust`;
        case "surrender":
          return `Surrendered`; // never reaches settleRound
      }
    };

    let message: string;
    if (h1 !== null) {
      message = `Hand 1: ${msg(h0.result, handValue(this.state.playerHand), this.state.bet)}  ·  Hand 2: ${msg(h1.result, handValue(this.state.splitHand!), this.state.splitBet)}`;
    } else {
      // Single hand — use friendlier phrasing
      switch (h0.result) {
        case "blackjack":
          message = `Blackjack! You win ${h0.payout - this.state.bet} chips.`;
          break;
        case "win":
          message = dealerBust
            ? `Dealer busts! You win ${this.state.bet} chips.`
            : `You win! ${handValue(this.state.playerHand)} beats ${dealerVal}.`;
          break;
        case "push":
          message = `Push. Bet returned.`;
          break;
        case "lose":
          message = `Dealer wins. ${dealerVal} beats ${handValue(this.state.playerHand)}.`;
          break;
        default:
          message = `Bust!`;
          break;
      }
    }

    const anyWin =
      h0.result === "win" ||
      h0.result === "blackjack" ||
      h1?.result === "win" ||
      h1?.result === "blackjack";
    const allLost =
      (h0.result === "lose" || h0.result === "bust") &&
      (h1 === null || h1.result === "lose" || h1.result === "bust");

    this.state = {
      ...this.state,
      phase: "ROUND_OVER",
      roundResult: h0.result,
      splitResult: h1?.result ?? this.state.splitResult,
      chips: balance(),
      message,
      winner: anyWin ? "player" : allLost ? "computer" : null,
    };
  }

  newRound(): void {
    if (this.isSessionOver()) return;
    this.state = this.bettingState();
  }

  isSessionOver(): boolean {
    return balance() === 0 || balance() >= WIN_TARGET;
  }

  isSessionWon(): boolean {
    return balance() >= WIN_TARGET;
  }

  checkSession(): void {
    if (!this.isSessionOver()) return;
    const won = this.isSessionWon();
    this.state = {
      ...this.state,
      phase: "SESSION_OVER",
      chips: balance(),
      message: won
        ? `You did it! Bankroll up to ${balance()} chips!`
        : "Out of chips! Better luck next time.",
      winner: won ? "player" : "computer",
    };
  }

  private onHandComplete(): void {
    // If on hand 0 and split exists, advance to hand 1
    if (this.state.activeHand === 0 && this.state.splitHand !== null) {
      this.state.activeHand = 1;
      this.state.message =
        this.state.roundResult === "bust"
          ? "First hand busted. Playing second hand."
          : "Playing second hand — Hit or Stand?";
      // Auto-complete a natural blackjack on the second hand
      if (isBlackjack(this.state.splitHand)) {
        this.onHandComplete();
      }
      return;
    }
    // All hands done
    const h0Bust = this.state.roundResult === "bust";
    const h1Bust =
      this.state.splitHand !== null && this.state.splitResult === "bust";
    const allBust = h0Bust && (this.state.splitHand === null || h1Bust);

    if (allBust) {
      // Nothing comes back on an all-bust round, but the wagers still settle.
      this.settleWagers(0, 0);
      this.settleWagers(1, 0);
      this.state.holeRevealed = true;
      this.state.phase = "ROUND_OVER";
      this.state.chips = balance();
      this.state.message = this.state.splitHand
        ? "Both hands bust!"
        : `Bust! You had ${handValue(this.state.playerHand)}.`;
    } else {
      this.beginDealerTurn();
    }
  }

  /** Credit a hand's return to its first wager, close the rest, clear them. */
  private settleWagers(hand: 0 | 1, returned: number): void {
    this.handWagers[hand].forEach((w, i) => w.settle(i === 0 ? returned : 0));
    this.handWagers[hand] = [];
  }

  private markCurrentHandBust(): void {
    if (this.state.activeHand === 0) {
      this.state.roundResult = "bust";
    } else {
      this.state.splitResult = "bust";
    }
  }

  private activeHandCards(): PlayingCard[] {
    if (this.state.activeHand === 1 && this.state.splitHand !== null) {
      return this.state.splitHand;
    }
    return this.state.playerHand;
  }

  private setActiveHandCards(cards: PlayingCard[]): void {
    if (this.state.activeHand === 1 && this.state.splitHand !== null) {
      this.state.splitHand = cards;
    } else {
      this.state.playerHand = cards;
    }
  }

  private activeBet(): number {
    return this.state.activeHand === 1 ? this.state.splitBet : this.state.bet;
  }

  private buildShoe(): PlayingCard[] {
    const cards: PlayingCard[] = [];
    for (let i = 0; i < this.config.decks; i++) {
      cards.push(...createDeck());
    }
    return shuffle(cards);
  }

  /** Single deck reshuffles every round; a shoe persists until it runs low. */
  private prepareShoe(): void {
    if (this.config.decks === 1 || this.deck.length < RESHUFFLE_BELOW) {
      this.deck = this.buildShoe();
    }
  }

  private draw(): PlayingCard {
    if (this.deck.length === 0) {
      this.deck = this.buildShoe();
    }
    const card = this.deck.pop()!;
    this.state.shoeDepth = this.deck.length;
    return card;
  }
}
