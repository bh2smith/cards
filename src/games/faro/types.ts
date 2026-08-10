import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";
import type { Wager } from "../../shared/engine/betting";

export type FaroPhase = "BETTING" | "TURN_RESULT" | "SHOE_OVER";

/** Rank index = typedeck CardName (Ace = 0 … King = 12). */
export type FaroRank = number;

export const RANK_COUNT = 13;

/**
 * Turns per shoe: soda (1) + 25 turns × 2 + hock (1) = 52. The historical
 * last-turn "calling the turn" bet is out of scope; the final turn settles
 * like any other and the hock is never in play.
 */
export const TURNS_PER_SHOE = 25;

export interface FaroBet {
  rank: FaroRank;
  wager: Wager;
  /** Coppered bets invert polarity: win on the banker's card, lose on the player's. */
  coppered: boolean;
}

export interface FaroTurn {
  /** First card of the turn — bets on its rank lose. */
  bankerCard: PlayingCard;
  /** Second card of the turn — bets on its rank win. */
  playerCard: PlayingCard;
  /** Both cards share a rank; the bank takes half of any bet on it. */
  split: boolean;
}

export interface FaroState extends BaseGameState {
  phase: FaroPhase;
  /** First card of the shoe, burned face-up. */
  soda: PlayingCard;
  /** Last card of the shoe, never in play. Revealed once the shoe ends. */
  hock: PlayingCard | null;
  /** Completed turns, 0..TURNS_PER_SHOE. */
  turnNumber: number;
  lastTurn: FaroTurn | null;
  /** Open layout bets; a wager persists until its rank turns or the shoe ends. */
  bets: FaroBet[];
  /** Casekeeper: cards of each rank seen so far (soda + turned cards), 0–4. */
  caseCounts: number[];
  /** Bankroll snapshot after the most recent action. */
  balance: number;
}
