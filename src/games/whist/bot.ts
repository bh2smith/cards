import { CardName, Suit, type PlayingCard } from "typedeck";
import type { TrickRules } from "../../shared/engine/trick";
import {
  type HandType,
  type PlayerIndex,
  type Trick,
  SUITS,
  aceHighRank,
} from "./types";

export interface PlayIntent {
  /** Try to take this trick (false = duck / shed). */
  wantWin: boolean;
  /** Partner seat in partnership modes (skip winning over a winning partner). */
  partner: PlayerIndex | null;
}

function minBy(cards: PlayingCard[], value: (c: PlayingCard) => number) {
  return cards.reduce((lo, c) => (value(c) < value(lo) ? c : lo));
}

function maxBy(cards: PlayingCard[], value: (c: PlayingCard) => number) {
  return cards.reduce((hi, c) => (value(c) > value(hi) ? c : hi));
}

/**
 * Rule-based trick play. Winning intent: win as cheaply as possible unless the
 * partner already has the trick; otherwise throw the lowest card. Ducking
 * intent: shed the highest card that cannot win, else win as cheaply as forced.
 */
export function choosePlay(
  legal: PlayingCard[],
  trick: Trick,
  rules: TrickRules,
  intent: PlayIntent,
): PlayingCard {
  if (trick.plays.length === 0) {
    // Leading: strongest card when hunting tricks, lowest rank when ducking.
    if (intent.wantWin) {
      return maxBy(
        legal,
        (c) => rules.strength(c, rules.effectiveSuit(c)) * 100 + aceHighRank(c),
      );
    }
    return minBy(legal, aceHighRank);
  }

  const ledSuit = rules.effectiveSuit(trick.plays[0]!.card);
  let best = trick.plays[0]!;
  let bestStrength = rules.strength(best.card, ledSuit);
  for (const play of trick.plays.slice(1)) {
    const s = rules.strength(play.card, ledSuit);
    if (s > bestStrength) {
      bestStrength = s;
      best = play;
    }
  }
  const cost = (c: PlayingCard) =>
    rules.strength(c, ledSuit) * 100 + aceHighRank(c);

  if (intent.wantWin) {
    const partnerWinning =
      intent.partner !== null && best.player === intent.partner;
    if (!partnerWinning) {
      const winners = legal.filter(
        (c) => rules.strength(c, ledSuit) > bestStrength,
      );
      if (winners.length > 0) return minBy(winners, cost); // win cheaply
    }
    return minBy(legal, cost); // partner has it, or we can't win
  }

  const losers = legal.filter(
    (c) => rules.strength(c, ledSuit) <= bestStrength,
  );
  if (losers.length > 0) return maxBy(losers, aceHighRank); // shed high
  return minBy(legal, cost); // forced to win — do it cheaply
}

/**
 * Oh Hell bid: roughly one trick per high trump or off-suit ace, half for
 * kings and low trump. Never bids the dealer's forbidden hook value.
 */
export function chooseBid(
  hand: PlayingCard[],
  trump: Suit | null,
  handSize: number,
  forbidden: number | null,
): number {
  let estimate = 0;
  for (const c of hand) {
    const rank = aceHighRank(c);
    if (trump !== null && c.suit === trump) estimate += rank >= 11 ? 1 : 0.5;
    else if (rank === 14) estimate += 1;
    else if (rank === 13) estimate += 0.5;
  }
  let bid = Math.max(0, Math.min(handSize, Math.round(estimate)));
  if (bid === forbidden) bid = bid > 0 ? bid - 1 : bid + 1;
  return bid;
}

/** Knockout trump choice: the hand's longest suit. */
export function chooseTrumpSuit(hand: PlayingCard[]): Suit {
  let best = SUITS[0]!;
  let bestCount = -1;
  for (const suit of SUITS) {
    const count = hand.filter((c) => c.suit === suit).length;
    if (count > bestCount) {
      bestCount = count;
      best = suit;
    }
  }
  return best;
}

/** Norwegian declaration: grand with 2+ aces or a long strong suit. */
export function chooseDeclaration(hand: PlayingCard[]): HandType | "pass" {
  const aces = hand.filter((c) => c.cardName === CardName.Ace).length;
  if (aces >= 2) return "grand";
  for (const suit of SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    const honors = cards.filter((c) => aceHighRank(c) >= 12).length;
    if (cards.length >= 5 && honors >= 2) return "grand";
  }
  return "pass";
}
