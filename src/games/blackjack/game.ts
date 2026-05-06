import type { PlayingCard } from "typedeck";
import { createDeck, shuffle, cardOrder } from "../../shared/deck";
import type { BlackjackState, RoundResult } from "./types";
import { STARTING_CHIPS } from "./types";

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

export function shouldDealerHit(cards: PlayingCard[]): boolean {
  const value = handValue(cards);
  return value < 17 || (value === 17 && isSoft(cards));
}

export class BlackjackGame {
  private state: BlackjackState;
  private deck: PlayingCard[] = [];

  constructor(chips = STARTING_CHIPS) {
    this.state = this.bettingState(chips);
  }

  private bettingState(chips: number): BlackjackState {
    return {
      phase: "BETTING",
      playerHand: [],
      dealerHand: [],
      holeRevealed: false,
      chips,
      bet: 0,
      roundResult: null,
      message: "Place your bet.",
      winner: null,
    };
  }

  getState(): Readonly<BlackjackState> {
    return this.state;
  }

  canBet(amount: number): boolean {
    return this.state.phase === "BETTING" && amount <= this.state.chips;
  }

  placeBet(amount: number): void {
    if (!this.canBet(amount)) return;
    this.deck = shuffle(createDeck());

    const playerHand = [this.draw(), this.draw()];
    const dealerHand = [this.draw(), this.draw()];

    this.state = {
      ...this.state,
      phase: "PLAYER_TURN",
      playerHand,
      dealerHand,
      holeRevealed: false,
      chips: this.state.chips - amount,
      bet: amount,
      roundResult: null,
      message: "",
      winner: null,
    };

    if (isBlackjack(playerHand)) {
      this.state.message = "Blackjack!";
    } else {
      this.state.message = "Hit or stand?";
    }
  }

  canDoubleDown(): boolean {
    return (
      this.state.phase === "PLAYER_TURN" &&
      this.state.playerHand.length === 2 &&
      this.state.chips >= this.state.bet
    );
  }

  doubleDown(): void {
    if (!this.canDoubleDown()) return;
    this.state.chips -= this.state.bet;
    this.state.bet *= 2;
    this.state.playerHand = [...this.state.playerHand, this.draw()];
    if (isBust(this.state.playerHand)) {
      this.state.holeRevealed = true;
      this.state.phase = "ROUND_OVER";
      this.state.roundResult = "bust";
      this.state.message = `Bust! You had ${handValue(this.state.playerHand)}.`;
    }
    // if not bust, UI triggers dealer sequence
  }

  hit(): void {
    if (this.state.phase !== "PLAYER_TURN") return;
    if (isBlackjack(this.state.playerHand)) return;

    this.state.playerHand = [...this.state.playerHand, this.draw()];

    if (isBust(this.state.playerHand)) {
      this.state.holeRevealed = true;
      this.state.phase = "ROUND_OVER";
      this.state.roundResult = "bust";
      this.state.message = `Bust! You had ${handValue(this.state.playerHand)}.`;
    } else {
      this.state.message = "Hit or stand?";
    }
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
    if (!shouldDealerHit(this.state.dealerHand)) return false;
    this.state.dealerHand = [...this.state.dealerHand, this.draw()];
    return true;
  }

  settleRound(): void {
    if (this.state.phase !== "DEALER_TURN") return;

    const playerVal = handValue(this.state.playerHand);
    const dealerVal = handValue(this.state.dealerHand);
    const dealerBust = isBust(this.state.dealerHand);
    const playerBJ = isBlackjack(this.state.playerHand);

    let result: RoundResult;
    let payout = 0;

    if (playerBJ && !isBlackjack(this.state.dealerHand)) {
      result = "blackjack";
      payout = Math.floor(this.state.bet * 2.5); // 3:2 payout
    } else if (dealerBust || playerVal > dealerVal) {
      result = "win";
      payout = this.state.bet * 2;
    } else if (playerVal === dealerVal) {
      result = "push";
      payout = this.state.bet;
    } else {
      result = "lose";
      payout = 0;
    }

    const newChips = this.state.chips + payout;

    const messages: Record<RoundResult, string> = {
      blackjack: `Blackjack! You win ${payout - this.state.bet} chips.`,
      win: dealerBust
        ? `Dealer busts! You win ${this.state.bet} chips.`
        : `You win! ${playerVal} beats ${dealerVal}.`,
      push: `Push. Bet returned.`,
      lose: `Dealer wins. ${dealerVal} beats ${playerVal}.`,
      bust: `Bust!`,
    };

    this.state = {
      ...this.state,
      phase: "ROUND_OVER",
      roundResult: result,
      chips: newChips,
      message: messages[result],
      winner: result === "win" || result === "blackjack" ? "player" : result === "lose" || result === "bust" ? "computer" : null,
    };
  }

  newRound(): void {
    if (this.state.chips === 0) {
      this.state = this.bettingState(STARTING_CHIPS);
      this.state.message = "Out of chips! Starting fresh with 100.";
      return;
    }
    const chips = this.state.chips;
    this.state = this.bettingState(chips);
  }

  private draw(): PlayingCard {
    if (this.deck.length === 0) {
      this.deck = shuffle(createDeck());
    }
    return this.deck.pop()!;
  }
}
