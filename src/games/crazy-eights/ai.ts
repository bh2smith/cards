import { CardName, Suit, type PlayingCard } from "typedeck";
import { WILD_RANK, WILD_VALUE, cardValue } from "./types";

const SUITS: Suit[] = [Suit.Clubs, Suit.Spades, Suit.Diamonds, Suit.Hearts];

/**
 * Choose which legal card to play. Prefers shedding a high-value non-wild so
 * wilds are saved for when nothing else matches (and to dump penalty points).
 * Returns an index into `hand`.
 */
export function botChoosePlay(
  hand: readonly PlayingCard[],
  legalIndices: readonly number[],
  wildRank: CardName = WILD_RANK,
  wildValue: number = WILD_VALUE,
): number {
  const nonWilds = legalIndices.filter((i) => hand[i]!.cardName !== wildRank);
  const pool = nonWilds.length > 0 ? nonWilds : legalIndices;

  let best = pool[0]!;
  let bestValue = -1;
  for (const i of pool) {
    const v = cardValue(hand[i]!, wildRank, wildValue);
    if (v > bestValue) {
      bestValue = v;
      best = i;
    }
  }
  return best;
}

/**
 * After playing a wild, pick the suit the bot holds the most of (excluding
 * other wilds). Falls back to clubs when the hand is empty or all wilds.
 */
export function botChooseSuit(
  hand: readonly PlayingCard[],
  wildRank: CardName = WILD_RANK,
): Suit {
  const counts = new Map<Suit, number>();
  for (const card of hand) {
    if (card.cardName === wildRank) continue;
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
