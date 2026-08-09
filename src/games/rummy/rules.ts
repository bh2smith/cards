import { CardName, Suit, type PlayingCard } from "typedeck";
import { cardKey, cardOrder } from "../../shared/deck";
import { findAllRuns, findAllSets, type Meld } from "../../shared/engine/melds";
import type { RummyConfig } from "./config";
import type { TableMeld } from "./types";

export const UNDERCUT_BONUS = 10;

/** Pip value: A=1, 2-9 face value, 10/J/Q/K = 10. */
export function pipValue(card: PlayingCard): number {
  const order = cardOrder(card);
  return order >= 10 ? 10 : order;
}

export function isSpadeQueen(card: PlayingCard): boolean {
  return card.cardName === CardName.Queen && card.suit === Suit.Spades;
}

/** Value of a card counted against a hand at settlement. */
export function handCardValue(card: PlayingCard, cfg: RummyConfig): number {
  if (cfg.scoring === "points-500") {
    if (cfg.spadeQueenBonus && isSpadeQueen(card)) return 50;
    if (card.cardName === CardName.Ace) return 15;
  }
  return pipValue(card);
}

export function handValue(
  cards: readonly PlayingCard[],
  cfg: RummyConfig,
): number {
  return cards.reduce((sum, c) => sum + handCardValue(c, cfg), 0);
}

/**
 * Value a card scores when laid into the given meld. Aces count 15 in sets and
 * ace-high runs, 1 in low runs (a run containing the two of the suit).
 */
export function meldCardValue(
  card: PlayingCard,
  meld: { type: "set" | "run"; cards: PlayingCard[] },
  cfg: RummyConfig,
): number {
  if (cfg.spadeQueenBonus && isSpadeQueen(card)) return 50;
  if (cfg.scoring === "points-500" && card.cardName === CardName.Ace) {
    if (meld.type === "set") return 15;
    const isLow = meld.cards.some((c) => c.cardName === CardName.Two);
    return isLow ? 1 : 15;
  }
  return pipValue(card);
}

export function meldValue(
  meld: { type: "set" | "run"; cards: PlayingCard[] },
  cfg: RummyConfig,
): number {
  return meld.cards.reduce((sum, c) => sum + meldCardValue(c, meld, cfg), 0);
}

/**
 * Classify an exact group of cards as a set or run (run cards returned in
 * sequence order), or null when they form neither.
 */
export function classifyMeld(
  cards: PlayingCard[],
  runOptions: RummyConfig["runOptions"],
): Meld | null {
  if (cards.length < 3) return null;
  if (new Set(cards.map(cardKey)).size !== cards.length) return null;
  if (cards.every((c) => c.cardName === cards[0]!.cardName)) {
    return cards.length <= 4 ? { type: "set", cards: [...cards] } : null;
  }
  return (
    findAllRuns(cards, { ...runOptions, minLength: cards.length }).find(
      (m) => m.cards.length === cards.length,
    ) ?? null
  );
}

/**
 * The meld with the given card added (sets grow to 4; runs extend at either
 * end per the run options), or null when the card doesn't fit.
 */
export function extendMeld(
  meld: TableMeld | Meld,
  card: PlayingCard,
  runOptions: RummyConfig["runOptions"],
): Meld | null {
  if (meld.type === "set") {
    return meld.cards.length < 4 && card.cardName === meld.cards[0]!.cardName
      ? { type: "set", cards: [...meld.cards, card] }
      : null;
  }
  const extended = classifyMeld([...meld.cards, card], runOptions);
  return extended?.type === "run" ? extended : null;
}

/** All candidate melds within `cards` that include `card`. */
export function meldsContaining(
  cards: PlayingCard[],
  card: PlayingCard,
  runOptions: RummyConfig["runOptions"],
): Meld[] {
  const key = cardKey(card);
  return [...findAllSets(cards), ...findAllRuns(cards, runOptions)].filter(
    (m) => m.cards.some((c) => cardKey(c) === key),
  );
}

/** The highest-value meld within `cards` that includes `card`, if any. */
export function bestMeldContaining(
  cards: PlayingCard[],
  card: PlayingCard,
  cfg: RummyConfig,
): Meld | null {
  let best: Meld | null = null;
  let bestVal = -1;
  for (const m of meldsContaining(cards, card, cfg.runOptions)) {
    const v = meldValue(m, cfg);
    if (v > bestVal) {
      best = m;
      bestVal = v;
    }
  }
  return best;
}

/** Whether `card` can be melded from `cards` or laid off onto a table meld. */
export function canUseCard(
  card: PlayingCard,
  cards: PlayingCard[],
  tableMelds: readonly TableMeld[],
  cfg: RummyConfig,
): boolean {
  if (meldsContaining(cards, card, cfg.runOptions).length > 0) return true;
  if (!cfg.layOffAllowed) return false;
  return tableMelds.some((m) => extendMeld(m, card, cfg.runOptions) !== null);
}
