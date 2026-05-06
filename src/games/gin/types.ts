import type { PlayingCard } from "typedeck";
import type { BaseGameState, Player } from "../../shared/types";
import { cardOrder } from "../../shared/deck";

export type GinPhase =
  | "DRAWING"
  | "DISCARDING"
  | "BOT_TURN"
  | "ROUND_OVER"
  | "GAME_OVER";

export interface Meld {
  type: "set" | "run";
  cards: PlayingCard[];
}

export interface KnockResult {
  knocker: Player;
  knockerMelds: Meld[];
  knockerDeadwood: PlayingCard[];
  knockerDeadwoodValue: number;
  defenderMelds: Meld[];
  defenderDeadwood: PlayingCard[];
  defenderDeadwoodValue: number;
  isGin: boolean;
  isUndercut: boolean;
  roundPoints: number;
  pointsTo: Player;
}

export interface GinState extends BaseGameState {
  phase: GinPhase;
  playerScore: number;
  computerScore: number;
  dealer: Player;
  currentTurn: Player;
  playerHand: PlayingCard[];
  computerHand: PlayingCard[];
  stock: PlayingCard[];
  discardPile: PlayingCard[];
  knockResult: KnockResult | null;
  winner: Player | null;
}

export const WINNING_SCORE = 100;
export const GIN_BONUS = 25;
export const UNDERCUT_BONUS = 25;
export const KNOCK_THRESHOLD = 10;

export function pipValue(card: PlayingCard): number {
  const order = cardOrder(card);
  return order >= 10 ? 10 : order;
}

export function sortHand(hand: PlayingCard[]): void {
  hand.sort((a, b) => cardOrder(a) - cardOrder(b) || a.suit - b.suit);
}
