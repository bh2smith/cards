import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";
import { betOptions } from "../../shared/engine/betting";
import { STARTING_CHIPS } from "../../shared/engine/bankroll";

export type BlackjackPhase =
  | "BETTING"
  | "PLAYER_TURN"
  | "DEALER_TURN"
  | "ROUND_OVER"
  | "SESSION_OVER";

export type RoundResult =
  | "win"
  | "blackjack"
  | "lose"
  | "bust"
  | "push"
  | "surrender";

export interface BlackjackState extends BaseGameState {
  phase: BlackjackPhase;
  playerHand: PlayingCard[];
  splitHand: PlayingCard[] | null;
  splitBet: number;
  activeHand: 0 | 1;
  dealerHand: PlayingCard[];
  holeRevealed: boolean;
  /** Live shared bankroll balance — persists across games and sessions. */
  chips: number;
  bet: number;
  /** Cards left in the shoe (shown in the UI for multi-deck variants). */
  shoeDepth: number;
  roundResult: RoundResult | null;
  splitResult: RoundResult | null;
}

/** Session won when the shared bankroll triples its starting seed. */
export const WIN_TARGET = STARTING_CHIPS * 3;

/** Thin wrapper over the shared betting engine's bet steps. */
export function getBetOptions(chips: number): number[] {
  return betOptions(chips);
}
