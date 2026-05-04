import { CardName, Suit, type PlayingCard } from "typedeck";

// -- cribbage-counter type declaration --

export interface ScoringPoint {
  name: string;
  cards: string[];
  points: number;
}

export interface ScoreResult {
  score: number;
  points: ScoringPoint[];
}

declare module "cribbage-counter" {
  export function scoreHand(hand: string, isCrib: boolean): ScoreResult;
}

// -- Adapter: typedeck → cribbage-counter string format --

const RANK_TO_CHAR: Record<number, string> = {
  [CardName.Ace]: "A",
  [CardName.Two]: "2",
  [CardName.Three]: "3",
  [CardName.Four]: "4",
  [CardName.Five]: "5",
  [CardName.Six]: "6",
  [CardName.Seven]: "7",
  [CardName.Eight]: "8",
  [CardName.Nine]: "9",
  [CardName.Ten]: "T",
  [CardName.Jack]: "J",
  [CardName.Queen]: "Q",
  [CardName.King]: "K",
};

const SUIT_TO_CHAR: Record<number, string> = {
  [Suit.Clubs]: "C",
  [Suit.Spades]: "S",
  [Suit.Diamonds]: "D",
  [Suit.Hearts]: "H",
};

export const SUIT_SYMBOL: Record<number, string> = {
  [Suit.Clubs]: "♣",
  [Suit.Spades]: "♠",
  [Suit.Diamonds]: "♦",
  [Suit.Hearts]: "♥",
};

export const RANK_DISPLAY: Record<number, string> = {
  [CardName.Ace]: "A",
  [CardName.Two]: "2",
  [CardName.Three]: "3",
  [CardName.Four]: "4",
  [CardName.Five]: "5",
  [CardName.Six]: "6",
  [CardName.Seven]: "7",
  [CardName.Eight]: "8",
  [CardName.Nine]: "9",
  [CardName.Ten]: "10",
  [CardName.Jack]: "J",
  [CardName.Queen]: "Q",
  [CardName.King]: "K",
};

export function toCounterString(card: PlayingCard): string {
  return RANK_TO_CHAR[card.cardName] + SUIT_TO_CHAR[card.suit];
}

export function peggingValue(card: PlayingCard): number {
  return Math.min(card.cardName + 1, 10);
}

export function cardOrder(card: PlayingCard): number {
  return card.cardName + 1; // A=1, 2=2, ..., K=13
}

export function isRed(card: PlayingCard): boolean {
  return card.suit === Suit.Diamonds || card.suit === Suit.Hearts;
}

export function cardKey(card: PlayingCard): string {
  return `${card.cardName}-${card.suit}`;
}

// -- Game types --

export type Player = "player" | "computer";

export type GamePhase =
  | "NEW_GAME"
  | "DEALING"
  | "DISCARDING"
  | "CUTTING"
  | "PEGGING"
  | "COUNTING_NONDEALER"
  | "COUNTING_DEALER"
  | "COUNTING_CRIB"
  | "ROUND_OVER"
  | "GAME_OVER";

export interface PeggingResult {
  card: PlayingCard | null;
  pointsScored: number;
  details: string[];
  isGo: boolean;
  isThirtyOne: boolean;
  countReset: boolean;
}

export interface GameState {
  phase: GamePhase;
  playerScore: number;
  computerScore: number;
  dealer: Player;
  playerHand: PlayingCard[];
  computerHand: PlayingCard[];
  crib: PlayingCard[];
  starterCard: PlayingCard | null;

  peggingPile: PlayingCard[];
  peggingCount: number;
  currentTurn: Player;
  playerPassed: boolean;
  computerPassed: boolean;
  playerPeggingHand: PlayingCard[];
  computerPeggingHand: PlayingCard[];

  message: string;
  lastScoringDetails: string[];
  winner: Player | null;
}

export const WINNING_SCORE = 121;
