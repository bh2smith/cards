import { type PlayingCard, CardName, Suit } from "typedeck";
import {
  type HeartsState,
  type PlayerIndex,
  cardPoints,
  heartsRank,
  isQueenOfSpades,
} from "./types";
import { isLeading, legalPlays } from "./trick";

/**
 * Pass selection: dump dangerous cards.
 * Priority:
 *   1. Q♠ if not guarded (fewer than 4 spades, OR no K♠/A♠ to protect with)
 *   2. K♠ / A♠ (high spades that risk eating the queen)
 *   3. High hearts (A♥, K♥, Q♥) ordered descending
 *   4. Highest cards in shortest off-suit (creates a void)
 */
export function botChoosePass(hand: PlayingCard[]): number[] {
  const indices: number[] = [];
  const used = new Set<number>();

  const findIdx = (pred: (c: PlayingCard) => boolean): number => {
    for (let i = 0; i < hand.length; i++) {
      if (used.has(i)) continue;
      if (pred(hand[i]!)) return i;
    }
    return -1;
  };

  const pick = (idx: number) => {
    if (idx < 0 || used.has(idx)) return;
    used.add(idx);
    indices.push(idx);
  };

  const spadesCount = hand.filter((c) => c.suit === Suit.Spades).length;
  const queenGuarded = spadesCount >= 4;
  if (!queenGuarded) {
    const qIdx = findIdx(isQueenOfSpades);
    if (qIdx >= 0) pick(qIdx);
  }

  const dangerSpades = [CardName.Ace, CardName.King];
  for (const rank of dangerSpades) {
    if (indices.length >= 3) break;
    const idx = findIdx((c) => c.suit === Suit.Spades && c.cardName === rank);
    if (idx >= 0) pick(idx);
  }

  const highHearts = [
    CardName.Ace,
    CardName.King,
    CardName.Queen,
    CardName.Jack,
  ];
  for (const rank of highHearts) {
    if (indices.length >= 3) break;
    const idx = findIdx((c) => c.suit === Suit.Hearts && c.cardName === rank);
    if (idx >= 0) pick(idx);
  }

  while (indices.length < 3) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    for (let i = 0; i < hand.length; i++) {
      if (used.has(i)) continue;
      const card = hand[i]!;
      if (queenGuarded && isQueenOfSpades(card)) continue;
      const score = heartsRank(card);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    pick(bestIdx);
  }

  return indices;
}

/**
 * Lead/follow play selection.
 *   Lead: lowest non-heart, non-Q♠ if possible, else lowest legal.
 *   Follow (has led suit): if trick has points, play highest card that doesn't win;
 *     if trick is clean, play highest in led suit (try to dump if Q♠ at risk).
 *   Follow (void): dump Q♠ if held; else dump highest heart; else highest non-spade.
 */
export function botChoosePlay(
  state: HeartsState,
  player: PlayerIndex,
): PlayingCard {
  const hand = state.hands[player]!;
  const trick = state.currentTrick!;
  const isFirstTrickOfRound = state.completedTricks.length === 0;
  const legals = legalPlays(
    hand,
    trick,
    state.heartsBroken,
    isFirstTrickOfRound,
  );

  if (isLeading(trick)) {
    return chooseLead(legals);
  }

  const ledSuit = trick.ledSuit!;
  const hasLedSuit = hand.some((c) => c.suit === ledSuit);
  if (hasLedSuit) {
    return chooseFollow(legals, trick.plays, ledSuit);
  }

  return chooseDump(legals);
}

function chooseLead(legals: PlayingCard[]): PlayingCard {
  const safe = legals.filter(
    (c) => c.suit !== Suit.Hearts && !isQueenOfSpades(c),
  );
  const pool = safe.length > 0 ? safe : legals;
  return pool.reduce((lo, c) => (heartsRank(c) < heartsRank(lo) ? c : lo));
}

function chooseFollow(
  legals: PlayingCard[],
  plays: { card: PlayingCard }[],
  ledSuit: Suit,
): PlayingCard {
  const points = plays.reduce((s, p) => s + cardPoints(p.card), 0);
  const highestSoFar = plays.reduce(
    (max, p) =>
      p.card.suit === ledSuit && heartsRank(p.card) > max
        ? heartsRank(p.card)
        : max,
    0,
  );

  if (points > 0) {
    const losers = legals.filter((c) => heartsRank(c) < highestSoFar);
    if (losers.length > 0) {
      return losers.reduce((hi, c) =>
        heartsRank(c) > heartsRank(hi) ? c : hi,
      );
    }
    return legals.reduce((lo, c) => (heartsRank(c) < heartsRank(lo) ? c : lo));
  }

  return legals.reduce((lo, c) => (heartsRank(c) < heartsRank(lo) ? c : lo));
}

function chooseDump(legals: PlayingCard[]): PlayingCard {
  const queen = legals.find(isQueenOfSpades);
  if (queen) return queen;

  const hearts = legals.filter((c) => c.suit === Suit.Hearts);
  if (hearts.length > 0) {
    return hearts.reduce((hi, c) => (heartsRank(c) > heartsRank(hi) ? c : hi));
  }

  const nonSpades = legals.filter((c) => c.suit !== Suit.Spades);
  const pool = nonSpades.length > 0 ? nonSpades : legals;
  return pool.reduce((hi, c) =>
    heartsRank(c) > heartsRank(hi) && !isQueenOfSpades(c) ? c : hi,
  );
}
