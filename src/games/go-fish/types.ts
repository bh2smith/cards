import type { CardName, PlayingCard } from "typedeck";
import type { BaseGameState, Player } from "../../shared/types";
import { cardOrder } from "../../shared/deck";

export type GoFishPhase = "PLAYER_TURN" | "BOT_TURN" | "GAME_OVER";

export interface GoFishState extends BaseGameState {
  phase: GoFishPhase;
  currentTurn: Player;
  playerHand: PlayingCard[];
  computerHand: PlayingCard[];
  /** Face-down draw pile ("the pond"). */
  pond: PlayingCard[];
  /** Ranks laid down as completed books of four. */
  playerBooks: CardName[];
  computerBooks: CardName[];
}

export const HAND_SIZE = 7;
export const BOOK_SIZE = 4;
export const TOTAL_BOOKS = 13;

export function countRank(
  hand: readonly PlayingCard[],
  rank: CardName,
): number {
  return hand.reduce((n, c) => (c.cardName === rank ? n + 1 : n), 0);
}

/** Sort a hand by rank (A low … K high), then by suit for stable grouping. */
export function sortHand(hand: PlayingCard[]): void {
  hand.sort((a, b) => cardOrder(a) - cardOrder(b) || a.suit - b.suit);
}
