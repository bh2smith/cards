import { type PlayingCard, CardName, Suit } from "typedeck";
import {
  type HeartsState,
  type PlayerIndex,
  cardPoints,
  heartsRank,
  isQueenOfSpades,
} from "./types";
import { HEARTS_FAMILY, type HeartsConfig } from "./config";
import { isLeading, legalPlays } from "./trick";

function isJackOfDiamonds(card: PlayingCard): boolean {
  return card.suit === Suit.Diamonds && card.cardName === CardName.Jack;
}

/**
 * Pass selection: dump dangerous cards.
 * Priority:
 *   1. Q♠ if penalized and not guarded (fewer than 4 spades)
 *   2. K♠ / A♠ when high spades are risky (guard the queen, or their own
 *      Black Maria penalties)
 *   3. High hearts (A♥, K♥, Q♥, J♥) ordered descending — the costliest
 *      hearts in Spot
 *   4. Highest remaining cards, keeping a guarded Q♠ and a bonus J♦
 */
export function botChoosePass(
  hand: PlayingCard[],
  cfg: HeartsConfig = HEARTS_FAMILY.base,
): number[] {
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

  const spadesRisky =
    cfg.spadePenalties.queen > 0 ||
    cfg.spadePenalties.king > 0 ||
    cfg.spadePenalties.ace > 0;
  const spadesCount = hand.filter((c) => c.suit === Suit.Spades).length;
  const queenGuarded = spadesCount >= 4;
  if (spadesRisky && cfg.spadePenalties.queen > 0 && !queenGuarded) {
    const qIdx = findIdx(isQueenOfSpades);
    if (qIdx >= 0) pick(qIdx);
  }

  if (spadesRisky) {
    const dangerSpades = [CardName.Ace, CardName.King];
    for (const rank of dangerSpades) {
      if (indices.length >= 3) break;
      const idx = findIdx((c) => c.suit === Suit.Spades && c.cardName === rank);
      if (idx >= 0) pick(idx);
    }
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
      if (queenGuarded && spadesRisky && isQueenOfSpades(card)) continue;
      if (cfg.jackDiamondsBonus < 0 && isJackOfDiamonds(card)) continue;
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
 *   Lead: lowest zero-point card if possible, else lowest legal.
 *   Follow (has led suit): if trick has penalty points, play highest card that
 *     doesn't win; if it holds a net bonus (J♦ in Omnibus), try to win it
 *     cheaply; if clean, play low.
 *   Follow (void): dump the highest-penalty card; else highest safe card.
 */
export function botChoosePlay(
  state: HeartsState,
  player: PlayerIndex,
  cfg: HeartsConfig = HEARTS_FAMILY.base,
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
    return chooseLead(legals, cfg);
  }

  const ledSuit = trick.ledSuit!;
  const hasLedSuit = hand.some((c) => c.suit === ledSuit);
  if (hasLedSuit) {
    return chooseFollow(legals, trick.plays, ledSuit, cfg);
  }

  return chooseDump(legals, cfg);
}

function chooseLead(legals: PlayingCard[], cfg: HeartsConfig): PlayingCard {
  const safe = legals.filter((c) => cardPoints(c, cfg) === 0);
  const pool = safe.length > 0 ? safe : legals;
  return pool.reduce((lo, c) => (heartsRank(c) < heartsRank(lo) ? c : lo));
}

function chooseFollow(
  legals: PlayingCard[],
  plays: { card: PlayingCard }[],
  ledSuit: Suit,
  cfg: HeartsConfig,
): PlayingCard {
  const points = plays.reduce((s, p) => s + cardPoints(p.card, cfg), 0);
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

  if (points < 0) {
    // Net bonus on the table (J♦): win it with the cheapest winning card.
    const winners = legals.filter((c) => heartsRank(c) > highestSoFar);
    if (winners.length > 0) {
      return winners.reduce((lo, c) =>
        heartsRank(c) < heartsRank(lo) ? c : lo,
      );
    }
  }

  return legals.reduce((lo, c) => (heartsRank(c) < heartsRank(lo) ? c : lo));
}

function chooseDump(legals: PlayingCard[], cfg: HeartsConfig): PlayingCard {
  // Highest-penalty card first (Q♠, Black Maria's A♠/K♠, hearts — worth the
  // most pips first in Spot); rank breaks ties.
  let worst: PlayingCard | null = null;
  for (const c of legals) {
    const pts = cardPoints(c, cfg);
    if (pts <= 0) continue;
    if (
      worst === null ||
      pts > cardPoints(worst, cfg) ||
      (pts === cardPoints(worst, cfg) && heartsRank(c) > heartsRank(worst))
    ) {
      worst = c;
    }
  }
  if (worst) return worst;

  // No penalty cards: shed the highest, keeping spades (which guard the Q♠)
  // and a bonus J♦ back when possible.
  const preferred = legals.filter(
    (c) => c.suit !== Suit.Spades && cardPoints(c, cfg) === 0,
  );
  const zeroPoint = legals.filter((c) => cardPoints(c, cfg) === 0);
  const pool =
    preferred.length > 0
      ? preferred
      : zeroPoint.length > 0
        ? zeroPoint
        : legals;
  return pool.reduce((hi, c) => (heartsRank(c) > heartsRank(hi) ? c : hi));
}
