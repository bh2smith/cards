import { CardName, Suit, type PlayingCard } from "typedeck";
import type { BaseGameState, Player } from "../../shared/types";
import { cardOrder } from "../../shared/deck";

export type CrazyEightsPhase =
  | "PLAYER_TURN"
  | "CHOOSE_SUIT"
  | "BOT_TURN"
  | "ROUND_OVER"
  | "GAME_OVER";

export interface CrazyEightsState extends BaseGameState {
  phase: CrazyEightsPhase;
  playerScore: number;
  computerScore: number;
  dealer: Player;
  currentTurn: Player;
  playerHand: PlayingCard[];
  computerHand: PlayingCard[];
  stock: PlayingCard[];
  discardPile: PlayingCard[];
  /** Suit currently in force. Equals the top card's suit unless an 8 set it. */
  activeSuit: Suit;
  /** Number of consecutive passes; two in a row ends a blocked round. */
  consecutivePasses: number;
  /** Times the stock has been reshuffled this round; a cap breaks stalemates. */
  reshuffles: number;
  roundWinner: Player | null;
  roundPoints: number;
  winner: Player | null;
}

export const HAND_SIZE = 7;
export const WINNING_SCORE = 100;
/**
 * If the stock is reshuffled this many times in one round, the cards are just
 * cycling (e.g. only eights remain playable) — end the round and score it.
 */
export const STALEMATE_RESHUFFLES = 5;
export const WILD_RANK = CardName.Eight;
export const WILD_VALUE = 50;

/** Penalty value of a card left in hand: 8 = 50, T/J/Q/K = 10, A = 1, else pip. */
export function cardValue(card: PlayingCard): number {
  if (card.cardName === WILD_RANK) return WILD_VALUE;
  const order = cardOrder(card); // A=1 … K=13
  return order >= 10 ? 10 : order;
}

export function handValue(hand: readonly PlayingCard[]): number {
  return hand.reduce((sum, c) => sum + cardValue(c), 0);
}

/**
 * A card is playable if it is an eight (wild), matches the active suit, or
 * matches the rank of the top discard.
 */
export function isLegalPlay(
  card: PlayingCard,
  activeSuit: Suit,
  topRank: CardName,
): boolean {
  return (
    card.cardName === WILD_RANK ||
    card.suit === activeSuit ||
    card.cardName === topRank
  );
}

const SUIT_SORT: Record<number, number> = {
  [Suit.Clubs]: 0,
  [Suit.Diamonds]: 1,
  [Suit.Hearts]: 2,
  [Suit.Spades]: 3,
};

/** Sort a hand by suit then rank, with eights pulled out to the right. */
export function sortHand(hand: PlayingCard[]): void {
  hand.sort((a, b) => {
    const aWild = a.cardName === WILD_RANK ? 1 : 0;
    const bWild = b.cardName === WILD_RANK ? 1 : 0;
    if (aWild !== bWild) return aWild - bWild;
    if (a.suit !== b.suit) return SUIT_SORT[a.suit]! - SUIT_SORT[b.suit]!;
    return cardOrder(a) - cardOrder(b);
  });
}
