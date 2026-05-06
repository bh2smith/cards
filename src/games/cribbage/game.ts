import {
  CardName,
  Suit,
  PlayingCard,
  Deck,
  Hand,
  AceLowRankSet,
} from "typedeck";
import {
  scoreShowHand,
  checkHisHeels,
  scorePeggingPlay,
  canPlay,
} from "./scoring";
import { chooseDiscards, choosePeggingCard } from "./ai";
import {
  peggingValue,
  type GameState,
  type GamePhase,
  type Player,
  type PeggingResult,
  type ScoreResult,
  WINNING_SCORE,
} from "./types";

const ALL_SUITS = [Suit.Clubs, Suit.Spades, Suit.Diamonds, Suit.Hearts];
const ALL_RANKS = [
  CardName.Ace,
  CardName.Two,
  CardName.Three,
  CardName.Four,
  CardName.Five,
  CardName.Six,
  CardName.Seven,
  CardName.Eight,
  CardName.Nine,
  CardName.Ten,
  CardName.Jack,
  CardName.Queen,
  CardName.King,
];

export class CribbageGame {
  private state: GameState;
  private deck!: Deck;

  constructor() {
    this.state = this.initialState();
  }

  private initialState(): GameState {
    return {
      phase: "NEW_GAME",
      playerScore: 0,
      computerScore: 0,
      dealer: Math.random() < 0.5 ? "player" : "computer",
      playerHand: [],
      computerHand: [],
      crib: [],
      starterCard: null,
      peggingPile: [],
      peggingCount: 0,
      currentTurn: "player",
      playerPassed: false,
      computerPassed: false,
      playerPeggingHand: [],
      computerPeggingHand: [],
      message: "Welcome to Cribbage! Cut for deal...",
      lastScoringDetails: [],
      winner: null,
    };
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  private addScore(who: Player, points: number): boolean {
    if (who === "player") {
      this.state.playerScore = Math.min(
        this.state.playerScore + points,
        WINNING_SCORE,
      );
      if (this.state.playerScore >= WINNING_SCORE) {
        this.state.winner = "player";
        this.state.phase = "GAME_OVER";
        this.state.message = "You win! 🎉";
        return true;
      }
    } else {
      this.state.computerScore = Math.min(
        this.state.computerScore + points,
        WINNING_SCORE,
      );
      if (this.state.computerScore >= WINNING_SCORE) {
        this.state.winner = "computer";
        this.state.phase = "GAME_OVER";
        this.state.message = "Computer wins!";
        return true;
      }
    }
    return false;
  }

  deal(): void {
    this.deck = Deck.Build(ALL_SUITS, ALL_RANKS);
    this.deck.shuffle();

    const playerHand = new Hand();
    const computerHand = new Hand();
    this.deck.deal(playerHand, 6);
    this.deck.deal(computerHand, 6);

    playerHand.sortCards(new AceLowRankSet());
    computerHand.sortCards(new AceLowRankSet());

    this.state.playerHand = (playerHand.getCards() as PlayingCard[]).sort(
      (a, b) => a.cardName - b.cardName || a.suit - b.suit,
    );
    this.state.computerHand = (computerHand.getCards() as PlayingCard[]).sort(
      (a, b) => a.cardName - b.cardName || a.suit - b.suit,
    );
    this.state.crib = [];
    this.state.starterCard = null;
    this.state.peggingPile = [];
    this.state.peggingCount = 0;
    this.state.playerPassed = false;
    this.state.computerPassed = false;
    this.state.lastScoringDetails = [];
    this.state.phase = "DISCARDING";
    this.state.message = `You are ${this.state.dealer === "player" ? "the dealer" : "not the dealer"}. Select 2 cards for the crib.`;
  }

  playerDiscard(indices: number[]): void {
    if (this.state.phase !== "DISCARDING" || indices.length !== 2) return;

    const sorted = [...indices].sort((a, b) => b - a);
    const discarded: PlayingCard[] = [];
    for (const idx of sorted) {
      discarded.push(this.state.playerHand.splice(idx, 1)[0]);
    }
    this.state.crib.push(...discarded);

    const aiDiscards = chooseDiscards(
      this.state.computerHand,
      this.state.dealer === "computer",
    );
    const aiSorted = [...aiDiscards].sort((a, b) => b - a);
    for (const idx of aiSorted) {
      this.state.crib.push(this.state.computerHand.splice(idx, 1)[0]);
    }

    this.state.phase = "CUTTING";
    this.state.message = "Cut the deck to reveal the starter card...";
  }

  cut(): { hisHeels: boolean } {
    const remaining = this.deck.getCards() as PlayingCard[];
    const cutIndex = Math.floor(Math.random() * remaining.length);
    this.state.starterCard = remaining[cutIndex];
    remaining.splice(cutIndex, 1);

    let hisHeels = false;
    if (checkHisHeels(this.state.starterCard)) {
      hisHeels = true;
      if (this.addScore(this.state.dealer, 2)) return { hisHeels };
      this.state.message = `Starter is a Jack! ${this.state.dealer === "player" ? "You get" : "Computer gets"} 2 for His Heels.`;
    } else {
      this.state.message = "Starter card revealed. Pegging begins!";
    }

    this.state.playerPeggingHand = [...this.state.playerHand];
    this.state.computerPeggingHand = [...this.state.computerHand];
    this.state.peggingPile = [];
    this.state.peggingCount = 0;
    this.state.playerPassed = false;
    this.state.computerPassed = false;
    this.state.currentTurn =
      this.state.dealer === "player" ? "computer" : "player";
    this.state.phase = "PEGGING";

    return { hisHeels };
  }

  playerPlayPeggingCard(card: PlayingCard): PeggingResult {
    if (this.state.phase !== "PEGGING" || this.state.currentTurn !== "player")
      return {
        card: null,
        pointsScored: 0,
        details: [],
        isGo: false,
        isThirtyOne: false,
        countReset: false,
      };

    const idx = this.state.playerPeggingHand.findIndex(
      (c) => c.cardName === card.cardName && c.suit === card.suit,
    );
    if (idx === -1) return this.emptyResult();

    const value = peggingValue(card);
    if (this.state.peggingCount + value > 31) return this.emptyResult();

    this.state.playerPeggingHand.splice(idx, 1);
    this.state.peggingPile.push(card);
    this.state.peggingCount += value;

    const { points, details } = scorePeggingPlay(
      this.state.peggingPile,
      this.state.peggingCount,
    );
    if (points > 0 && this.addScore("player", points)) {
      return {
        card,
        pointsScored: points,
        details,
        isGo: false,
        isThirtyOne: this.state.peggingCount === 31,
        countReset: false,
      };
    }

    const isThirtyOne = this.state.peggingCount === 31;
    let countReset = false;
    if (isThirtyOne) {
      this.resetPeggingCount();
      countReset = true;
    }

    this.state.playerPassed = false;
    this.state.computerPassed = false;
    this.advancePeggingTurn();

    return {
      card,
      pointsScored: points,
      details,
      isGo: false,
      isThirtyOne,
      countReset,
    };
  }

  playerGo(): PeggingResult {
    this.state.playerPassed = true;
    this.state.currentTurn = "computer";

    if (this.state.computerPassed) {
      this.addScore("computer", 1);
      this.resetPeggingCount();
      return {
        card: null,
        pointsScored: 0,
        details: ["Go - Computer gets 1"],
        isGo: true,
        isThirtyOne: false,
        countReset: true,
      };
    }

    return {
      card: null,
      pointsScored: 0,
      details: [],
      isGo: true,
      isThirtyOne: false,
      countReset: false,
    };
  }

  computerPlay(): PeggingResult {
    if (this.state.phase !== "PEGGING" || this.state.currentTurn !== "computer")
      return this.emptyResult();

    if (!canPlay(this.state.computerPeggingHand, this.state.peggingCount)) {
      this.state.computerPassed = true;

      if (this.state.playerPassed) {
        this.addScore("player", 1);
        this.resetPeggingCount();
        return {
          card: null,
          pointsScored: 0,
          details: ["Go - You get 1"],
          isGo: true,
          isThirtyOne: false,
          countReset: true,
        };
      }

      this.state.currentTurn = "player";
      return {
        card: null,
        pointsScored: 0,
        details: ["Computer says Go"],
        isGo: true,
        isThirtyOne: false,
        countReset: false,
      };
    }

    const card = choosePeggingCard(
      this.state.computerPeggingHand,
      this.state.peggingPile,
      this.state.peggingCount,
    );
    if (!card) return this.emptyResult();

    const idx = this.state.computerPeggingHand.findIndex(
      (c) => c.cardName === card.cardName && c.suit === card.suit,
    );
    this.state.computerPeggingHand.splice(idx, 1);
    this.state.peggingPile.push(card);
    this.state.peggingCount += peggingValue(card);

    const { points, details } = scorePeggingPlay(
      this.state.peggingPile,
      this.state.peggingCount,
    );
    if (points > 0 && this.addScore("computer", points)) {
      return {
        card,
        pointsScored: points,
        details,
        isGo: false,
        isThirtyOne: this.state.peggingCount === 31,
        countReset: false,
      };
    }

    const isThirtyOne = this.state.peggingCount === 31;
    let countReset = false;
    if (isThirtyOne) {
      this.resetPeggingCount();
      countReset = true;
    }

    this.state.playerPassed = false;
    this.state.computerPassed = false;
    this.advancePeggingTurn();

    return {
      card,
      pointsScored: points,
      details,
      isGo: false,
      isThirtyOne,
      countReset,
    };
  }

  isPeggingDone(): boolean {
    return (
      this.state.playerPeggingHand.length === 0 &&
      this.state.computerPeggingHand.length === 0
    );
  }

  awardLastCard(): { who: Player; points: number } | null {
    if (this.state.peggingPile.length === 0) return null;
    if (this.state.peggingCount === 31) return null;

    const lastPlayer =
      this.state.playerPeggingHand.length === 0 &&
      this.state.computerPeggingHand.length === 0
        ? this.state.currentTurn === "player"
          ? "computer"
          : "player"
        : this.state.currentTurn === "player"
          ? "computer"
          : "player";

    const who =
      this.state.peggingPile.length > 0 ? this.findLastPlayer() : lastPlayer;

    this.addScore(who, 1);
    return { who, points: 1 };
  }

  private findLastPlayer(): Player {
    const totalPlayerCards = 4 - this.state.playerPeggingHand.length;
    const totalComputerCards = 4 - this.state.computerPeggingHand.length;
    const totalPlayed = totalPlayerCards + totalComputerCards;

    if (totalPlayed === this.state.peggingPile.length) {
      if (this.state.currentTurn === "player") return "computer";
      return "player";
    }
    return this.state.currentTurn === "player" ? "computer" : "player";
  }

  startCounting(): void {
    const nonDealer: Player =
      this.state.dealer === "player" ? "computer" : "player";
    this.state.phase = "COUNTING_NONDEALER";
    this.state.message = `Counting ${nonDealer === "player" ? "your" : "computer's"} hand...`;
  }

  scoreCurrentPhaseHand(): ScoreResult & { who: Player } {
    if (!this.state.starterCard) return { score: 0, points: [], who: "player" };

    let hand: PlayingCard[];
    let who: Player;
    let isCrib = false;

    switch (this.state.phase) {
      case "COUNTING_NONDEALER":
        who = this.state.dealer === "player" ? "computer" : "player";
        hand =
          who === "player" ? this.state.playerHand : this.state.computerHand;
        break;
      case "COUNTING_DEALER":
        who = this.state.dealer;
        hand =
          who === "player" ? this.state.playerHand : this.state.computerHand;
        break;
      case "COUNTING_CRIB":
        who = this.state.dealer;
        hand = this.state.crib;
        isCrib = true;
        break;
      default:
        return { score: 0, points: [], who: "player" };
    }

    const result = scoreShowHand(hand, this.state.starterCard, isCrib);
    this.addScore(who, result.score);
    this.state.lastScoringDetails = result.points.map(
      (p) => `${p.name}: ${p.points}`,
    );

    return { ...result, who };
  }

  advanceCounting(): void {
    switch (this.state.phase) {
      case "COUNTING_NONDEALER":
        this.state.phase = "COUNTING_DEALER";
        this.state.message = `Counting ${this.state.dealer === "player" ? "your" : "computer's"} hand...`;
        break;
      case "COUNTING_DEALER":
        this.state.phase = "COUNTING_CRIB";
        this.state.message = `Counting ${this.state.dealer === "player" ? "your" : "computer's"} crib...`;
        break;
      case "COUNTING_CRIB":
        this.state.phase = "ROUND_OVER";
        this.state.message = "Round complete! Click to deal next round.";
        break;
    }
  }

  nextRound(): void {
    this.state.dealer = this.state.dealer === "player" ? "computer" : "player";
    this.deal();
  }

  newGame(): void {
    const newState = this.initialState();
    this.state = newState;
    this.deal();
  }

  private resetPeggingCount(): void {
    this.state.peggingPile = [];
    this.state.peggingCount = 0;
    this.state.playerPassed = false;
    this.state.computerPassed = false;
  }

  private advancePeggingTurn(): void {
    const opponent: Player =
      this.state.currentTurn === "player" ? "computer" : "player";
    const opponentHand =
      opponent === "player"
        ? this.state.playerPeggingHand
        : this.state.computerPeggingHand;

    if (canPlay(opponentHand, this.state.peggingCount)) {
      this.state.currentTurn = opponent;
    }
  }

  private emptyResult(): PeggingResult {
    return {
      card: null,
      pointsScored: 0,
      details: [],
      isGo: false,
      isThirtyOne: false,
      countReset: false,
    };
  }
}
