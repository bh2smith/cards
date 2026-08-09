import { type PlayingCard, CardName, Suit } from "typedeck";
import { cardOrder } from "../../shared/deck";

// Seats are clockwise: 0 = You (bottom), 1 = Left, 2 = Partner (top), 3 = Right.
// Partnerships: team 0 = {0, 2} (You + Partner), team 1 = {1, 3} (Left + Right).
export type PlayerIndex = 0 | 1 | 2 | 3;
export type Team = 0 | 1;

export type SpadesPhase = "BIDDING" | "PLAYING" | "HAND_OVER" | "GAME_OVER";

/** A bid of 0 is nil; otherwise 1–13. There is no passing. */
export type Bid = number;
export const NIL: Bid = 0;
export const MAX_BID = 13;

export interface TrickPlay {
  player: PlayerIndex;
  card: PlayingCard;
}

export interface Trick {
  leader: PlayerIndex;
  plays: TrickPlay[];
  winner: PlayerIndex | null;
}

export interface NilResult {
  player: PlayerIndex;
  made: boolean;
  points: number;
}

export interface TeamHandResult {
  contract: number; // combined partners' bids (nil contributes 0)
  tricks: number;
  made: boolean;
  contractPoints: number;
  bagsAdded: number;
  bagPenalties: number; // number of 10-bag penalties triggered this hand
  nils: NilResult[];
  total: number; // net score delta for the hand
}

export interface HandResult {
  teams: [TeamHandResult, TeamHandResult];
}

export interface SpadesState {
  phase: SpadesPhase;
  message: string;
  hands: PlayingCard[][]; // 4 hands
  dealer: PlayerIndex;
  bidTurn: PlayerIndex;
  bids: [Bid | null, Bid | null, Bid | null, Bid | null];
  currentTurn: PlayerIndex;
  currentTrick: Trick | null;
  completedTricks: Trick[];
  spadesBroken: boolean;
  tricksByPlayer: [number, number, number, number];
  tricksWon: [number, number]; // tricks this hand, per team
  bags: [number, number]; // accumulated overtricks, per team
  scores: [number, number]; // game score, per team
  handResult: HandResult | null;
  winner: Team | null;
}

export const HAND_SIZE = 13;
export const WINNING_SCORE = 500;
export const LOSING_SCORE = -200;
export const BAG_LIMIT = 10;
export const BAG_PENALTY = 100;
export const NIL_POINTS = 100;

export function teamOf(player: PlayerIndex): Team {
  return (player % 2) as Team;
}

export function partnerOf(player: PlayerIndex): PlayerIndex {
  return ((player + 2) % 4) as PlayerIndex;
}

export function nextPlayer(player: PlayerIndex): PlayerIndex {
  return ((player + 1) % 4) as PlayerIndex;
}

export function isSpade(card: PlayingCard): boolean {
  return card.suit === Suit.Spades;
}

/** Ace-high rank: 2..10, J=11, Q=12, K=13, A=14. */
export function spadesRank(card: PlayingCard): number {
  return card.cardName === CardName.Ace ? 14 : cardOrder(card);
}

/**
 * Comparable strength within a trick. Spades always trump the led suit;
 * off-suit non-spades cannot win.
 */
export function cardStrength(card: PlayingCard, ledSuit: Suit): number {
  if (isSpade(card)) return 100 + spadesRank(card);
  return card.suit === ledSuit ? spadesRank(card) : -1;
}

/** Combined contract for a team; unbid seats and nils contribute 0. */
export function teamContract(
  bids: readonly (Bid | null)[],
  team: Team,
): number {
  return (bids[team] ?? 0) + (bids[team + 2] ?? 0);
}
