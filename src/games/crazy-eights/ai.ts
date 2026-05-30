import { Suit, type PlayingCard } from "typedeck";
import { WILD_RANK, cardValue } from "./types";

const SUITS: Suit[] = [Suit.Clubs, Suit.Spades, Suit.Diamonds, Suit.Hearts];

/**
 * Choose which legal card to play. Prefers shedding a high-value non-eight so
 * eights are saved for when nothing else matches (and to dump penalty points).
 * Returns an index into `hand`.
 */
export function botChoosePlay(
  hand: readonly PlayingCard[],
  legalIndices: readonly number[],
): number {
  const nonEights = legalIndices.filter((i) => hand[i]!.cardName !== WILD_RANK);
  const pool = nonEights.length > 0 ? nonEights : legalIndices;

  let best = pool[0]!;
  let bestValue = -1;
  for (const i of pool) {
    const v = cardValue(hand[i]!);
    if (v > bestValue) {
      bestValue = v;
      best = i;
    }
  }
  return best;
}

/**
 * After playing an eight, pick the suit the bot holds the most of (excluding
 * other eights). Falls back to clubs when the hand is empty or all eights.
 */
export function botChooseSuit(hand: readonly PlayingCard[]): Suit {
  const counts = new Map<Suit, number>();
  for (const card of hand) {
    if (card.cardName === WILD_RANK) continue;
    counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  }

  let best: Suit = Suit.Clubs;
  let bestCount = -1;
  for (const suit of SUITS) {
    const count = counts.get(suit) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = suit;
    }
  }
  return best;
}
