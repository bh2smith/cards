import { Suit, type PlayingCard } from "typedeck";
import type { Player } from "../../shared/types";
import { createDeck, shuffle } from "../../shared/deck";
import { botChoosePlay, botChooseSuit } from "./ai";
import {
  type CrazyEightsState,
  HAND_SIZE,
  WILD_RANK,
  WINNING_SCORE,
  handValue,
  isLegalPlay,
} from "./types";

export interface BotMove {
  drewCount: number;
  playedCard: PlayingCard | null;
  chosenSuit: Suit | null;
  passed: boolean;
}

export class CrazyEightsGame {
  private state: CrazyEightsState;

  constructor() {
    this.state = this.initialState();
    this.deal();
  }

  private initialState(): CrazyEightsState {
    return {
      phase: "PLAYER_TURN",
      playerScore: 0,
      computerScore: 0,
      dealer: "computer",
      currentTurn: "player",
      playerHand: [],
      computerHand: [],
      stock: [],
      discardPile: [],
      activeSuit: Suit.Clubs,
      consecutivePasses: 0,
      roundWinner: null,
      roundPoints: 0,
      message: "",
      winner: null,
    };
  }

  getState(): Readonly<CrazyEightsState> {
    return this.state;
  }

  deal(): void {
    const deck = shuffle(createDeck());
    const playerHand = deck.slice(0, HAND_SIZE);
    const computerHand = deck.slice(HAND_SIZE, HAND_SIZE * 2);
    let cut = HAND_SIZE * 2;

    // The starter must not be an eight — bury eights until a normal card turns up.
    while (deck[cut]!.cardName === WILD_RANK) cut++;
    const starter = deck[cut]!;
    const rest = deck.slice(HAND_SIZE * 2);
    const starterIdx = rest.indexOf(starter);
    rest.splice(starterIdx, 1);

    const nonDealer: Player =
      this.state.dealer === "player" ? "computer" : "player";

    this.state = {
      ...this.state,
      phase: nonDealer === "computer" ? "BOT_TURN" : "PLAYER_TURN",
      currentTurn: nonDealer,
      playerHand,
      computerHand,
      stock: rest,
      discardPile: [starter],
      activeSuit: starter.suit,
      consecutivePasses: 0,
      roundWinner: null,
      roundPoints: 0,
      message:
        nonDealer === "player"
          ? "Your turn. Match the suit or rank, or play an eight."
          : "Computer's turn…",
      winner: this.state.winner,
    };
  }

  topCard(): PlayingCard {
    return this.state.discardPile[this.state.discardPile.length - 1]!;
  }

  /** Indices into the given hand that are legal to play right now. */
  legalPlays(hand: readonly PlayingCard[]): number[] {
    const topRank = this.topCard().cardName;
    const out: number[] = [];
    for (let i = 0; i < hand.length; i++) {
      if (isLegalPlay(hand[i]!, this.state.activeSuit, topRank)) out.push(i);
    }
    return out;
  }

  canPlayerDraw(): boolean {
    if (this.state.phase !== "PLAYER_TURN") return false;
    return this.legalPlays(this.state.playerHand).length === 0;
  }

  playerPlay(index: number): boolean {
    if (
      this.state.phase !== "PLAYER_TURN" ||
      this.state.currentTurn !== "player"
    )
      return false;
    const legal = new Set(this.legalPlays(this.state.playerHand));
    if (!legal.has(index)) return false;

    const card = this.state.playerHand.splice(index, 1)[0]!;
    this.state.discardPile.push(card);
    this.state.consecutivePasses = 0;

    if (this.state.playerHand.length === 0) {
      this.awardRound("player", handValue(this.state.computerHand));
      return true;
    }

    if (card.cardName === WILD_RANK) {
      this.state.phase = "CHOOSE_SUIT";
      this.state.message = "You played an eight — choose the next suit.";
    } else {
      this.state.activeSuit = card.suit;
      this.endPlayerTurn();
    }
    return true;
  }

  playerChooseSuit(suit: Suit): void {
    if (this.state.phase !== "CHOOSE_SUIT") return;
    this.state.activeSuit = suit;
    this.endPlayerTurn();
  }

  /** Draw a single card when the player has no legal play, or pass if none left. */
  playerDraw(): void {
    if (!this.canPlayerDraw()) return;
    this.ensureStock();
    if (this.state.stock.length === 0) {
      this.passTurn("player");
      return;
    }
    this.state.playerHand.push(this.state.stock.pop()!);
    if (this.legalPlays(this.state.playerHand).length > 0) {
      this.state.message = "You drew a playable card.";
    } else {
      this.state.message = "No match — draw again or pass.";
      if (this.state.stock.length === 0) this.ensureStock();
      if (this.state.stock.length === 0) this.passTurn("player");
    }
  }

  botTurn(): BotMove {
    if (this.state.phase !== "BOT_TURN") throw new Error("Not bot's turn");

    let drewCount = 0;
    let legal = this.legalPlays(this.state.computerHand);
    while (legal.length === 0) {
      this.ensureStock();
      if (this.state.stock.length === 0) {
        this.passTurn("computer");
        return { drewCount, playedCard: null, chosenSuit: null, passed: true };
      }
      this.state.computerHand.push(this.state.stock.pop()!);
      drewCount++;
      legal = this.legalPlays(this.state.computerHand);
    }

    const idx = botChoosePlay(this.state.computerHand, legal);
    const card = this.state.computerHand.splice(idx, 1)[0]!;
    this.state.discardPile.push(card);
    this.state.consecutivePasses = 0;

    if (this.state.computerHand.length === 0) {
      this.awardRound("computer", handValue(this.state.playerHand));
      return { drewCount, playedCard: card, chosenSuit: null, passed: false };
    }

    let chosenSuit: Suit | null = null;
    if (card.cardName === WILD_RANK) {
      chosenSuit = botChooseSuit(this.state.computerHand);
      this.state.activeSuit = chosenSuit;
    } else {
      this.state.activeSuit = card.suit;
    }

    this.state.currentTurn = "player";
    this.state.phase = "PLAYER_TURN";
    this.state.message = "Your turn.";
    return { drewCount, playedCard: card, chosenSuit, passed: false };
  }

  nextRound(): void {
    this.state.dealer = this.state.dealer === "player" ? "computer" : "player";
    this.deal();
  }

  newGame(): void {
    const dealer = this.state.dealer;
    this.state = this.initialState();
    this.state.dealer = dealer === "player" ? "computer" : "player";
    this.deal();
  }

  private endPlayerTurn(): void {
    this.state.currentTurn = "computer";
    this.state.phase = "BOT_TURN";
    this.state.message = "Computer's turn…";
  }

  private passTurn(who: Player): void {
    this.state.consecutivePasses++;
    if (this.state.consecutivePasses >= 2) {
      this.resolveBlocked();
      return;
    }
    const next: Player = who === "player" ? "computer" : "player";
    this.state.currentTurn = next;
    this.state.phase = next === "computer" ? "BOT_TURN" : "PLAYER_TURN";
    this.state.message =
      next === "player"
        ? "Computer passed. Your turn."
        : "You passed. Computer's turn…";
  }

  private resolveBlocked(): void {
    const playerValue = handValue(this.state.playerHand);
    const computerValue = handValue(this.state.computerHand);
    if (playerValue === computerValue) {
      this.awardRound(null, 0);
    } else if (playerValue < computerValue) {
      this.awardRound("player", computerValue - playerValue);
    } else {
      this.awardRound("computer", playerValue - computerValue);
    }
  }

  private awardRound(winner: Player | null, points: number): void {
    this.state.roundWinner = winner;
    this.state.roundPoints = points;
    if (winner === "player") this.state.playerScore += points;
    else if (winner === "computer") this.state.computerScore += points;

    const reachedTarget =
      this.state.playerScore >= WINNING_SCORE ||
      this.state.computerScore >= WINNING_SCORE;

    if (reachedTarget) {
      this.state.phase = "GAME_OVER";
      this.state.winner =
        this.state.playerScore >= this.state.computerScore
          ? "player"
          : "computer";
      this.state.message = `${this.state.winner === "player" ? "You win" : "Computer wins"} the game!`;
      return;
    }

    this.state.phase = "ROUND_OVER";
    if (winner === null) {
      this.state.message = "Blocked round — tied. No points.";
    } else if (winner === "player") {
      this.state.message = `You went out! +${points} points.`;
    } else {
      this.state.message = `Computer went out. +${points} points.`;
    }
  }

  /** Refill an empty stock by reshuffling the discard pile (keeping the top card). */
  private ensureStock(): void {
    if (this.state.stock.length > 0) return;
    if (this.state.discardPile.length <= 1) return;
    const top = this.state.discardPile.pop()!;
    this.state.stock = shuffle(this.state.discardPile);
    this.state.discardPile = [top];
  }
}
