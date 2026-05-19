import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";

export type BlackjackPhase =
  | "BETTING"
  | "PLAYER_TURN"
  | "DEALER_TURN"
  | "ROUND_OVER"
  | "SESSION_OVER";

export type RoundResult = "win" | "blackjack" | "lose" | "bust" | "push";

export interface BlackjackState extends BaseGameState {
  phase: BlackjackPhase;
  playerHand: PlayingCard[];
  splitHand: PlayingCard[] | null;
  splitBet: number;
  activeHand: 0 | 1;
  dealerHand: PlayingCard[];
  holeRevealed: boolean;
  chips: number;
  bet: number;
  roundResult: RoundResult | null;
  splitResult: RoundResult | null;
}

export const STARTING_CHIPS = 100;
export const WIN_TARGET = STARTING_CHIPS * 3;
export function getBetOptions(chips: number): number[] {
  if (chips < 10) return [1, 2, 5];
  if (chips < 25) return [1, 5, 10];
  return [5, 10, 25];
}
