import { type PlayingCard, CardName, Suit } from "typedeck";
import {
  type PlayerIndex,
  type Trick,
  cardStrength,
  effectiveSuit,
  isLeftBower,
  isRightBower,
  isTrump,
  partnerOf,
} from "./types";
import { legalPlays } from "./trick";

const ORDER_THRESHOLD = 6;
const NAME_THRESHOLD = 6;
const ALONE_THRESHOLD = 12;
const OFF_SUITS = [Suit.Hearts, Suit.Diamonds, Suit.Clubs, Suit.Spades];

function trumpValue(card: PlayingCard, trump: Suit): number {
  if (isRightBower(card, trump)) return 4;
  if (isLeftBower(card, trump)) return 3;
  switch (card.cardName) {
    case CardName.Ace:
      return 3;
    case CardName.King:
      return 2;
    case CardName.Queen:
      return 2;
    default:
      return 1; // Ten / Nine
  }
}

/** Rough strength of a hand if `trump` were trump. */
function evaluateSuit(hand: PlayingCard[], trump: Suit): number {
  let score = 0;
  for (const c of hand) {
    if (isTrump(c, trump)) score += trumpValue(c, trump);
    else if (c.cardName === CardName.Ace) score += 1; // off-suit ace
  }
  // ruffing potential: each non-trump suit we hold nothing in
  for (const s of OFF_SUITS) {
    if (s === trump) continue;
    if (!hand.some((c) => !isTrump(c, trump) && c.suit === s)) score += 1;
  }
  return score;
}

export interface BidDecision {
  action: "orderup" | "name" | "pass";
  suit?: Suit;
  alone: boolean;
}

export function botBidRound1(
  hand: PlayingCard[],
  upCard: PlayingCard,
  player: PlayerIndex,
  dealer: PlayerIndex,
): BidDecision {
  const trump = upCard.suit;
  let score = evaluateSuit(hand, trump);
  const upVal = trumpValue(upCard, trump);
  if (player === dealer) score += upVal;
  else if (partnerOf(player) === dealer) score += upVal * 0.5;
  else score -= upVal * 0.5;

  if (score >= ORDER_THRESHOLD) {
    return { action: "orderup", alone: score >= ALONE_THRESHOLD };
  }
  return { action: "pass", alone: false };
}

export function botBidRound2(
  hand: PlayingCard[],
  turnedDownSuit: Suit,
  player: PlayerIndex,
  dealer: PlayerIndex,
  mustName: boolean,
): BidDecision {
  let bestSuit: Suit | null = null;
  let bestScore = -Infinity;
  for (const s of OFF_SUITS) {
    if (s === turnedDownSuit) continue;
    const score = evaluateSuit(hand, s);
    if (score > bestScore) {
      bestScore = score;
      bestSuit = s;
    }
  }
  if (bestSuit === null) return { action: "pass", alone: false };

  if (mustName || bestScore >= NAME_THRESHOLD) {
    return {
      action: "name",
      suit: bestSuit,
      alone: bestScore >= ALONE_THRESHOLD,
    };
  }
  return { action: "pass", alone: false };
}

/** Dealer's discard after picking up the up-card. Sheds the weakest card. */
export function botDiscard(hand: PlayingCard[], trump: Suit): PlayingCard {
  const nonTrump = hand.filter((c) => !isTrump(c, trump));
  const pool = nonTrump.length > 0 ? nonTrump : hand;

  // Count printed-suit holdings to favour voiding a suit.
  const counts = new Map<Suit, number>();
  for (const c of pool) counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1);

  let worst = pool[0]!;
  let worstScore = Infinity;
  for (const c of pool) {
    const value = isTrump(c, trump)
      ? 100 + trumpValue(c, trump)
      : faceValue(c.cardName);
    // singletons get a small discount so we lean toward creating a void
    const singletonBonus = (counts.get(c.suit) ?? 0) === 1 ? -0.5 : 0;
    const s = value + singletonBonus;
    if (s < worstScore) {
      worstScore = s;
      worst = c;
    }
  }
  return worst;
}

function faceValue(cardName: CardName): number {
  switch (cardName) {
    case CardName.Ace:
      return 5;
    case CardName.King:
      return 4;
    case CardName.Queen:
      return 3;
    case CardName.Jack:
      return 2;
    case CardName.Ten:
      return 1;
    default:
      return 0;
  }
}

/** Global value used to compare cards for "highest/lowest" play. */
function globalValue(card: PlayingCard, trump: Suit): number {
  return cardStrength(card, trump, effectiveSuit(card, trump));
}

export function botPlay(
  hand: PlayingCard[],
  trick: Trick,
  trump: Suit,
): PlayingCard {
  const legal = legalPlays(hand, trick, trump);

  if (trick.plays.length === 0) {
    return chooseLead(legal, hand, trump);
  }

  const ledSuit = effectiveSuit(trick.plays[0]!.card, trump);
  let bestPlay = trick.plays[0]!;
  let bestStrength = cardStrength(bestPlay.card, trump, ledSuit);
  for (const p of trick.plays.slice(1)) {
    const s = cardStrength(p.card, trump, ledSuit);
    if (s > bestStrength) {
      bestStrength = s;
      bestPlay = p;
    }
  }

  // Is our partner currently winning the trick?
  const me = nextToPlay(trick);
  const winningIsPartner = bestPlay.player === partnerOf(me);

  if (winningIsPartner) {
    return lowest(legal, trump); // partner has it — throw our lowest
  }

  const winners = legal.filter(
    (c) => cardStrength(c, trump, ledSuit) > bestStrength,
  );
  if (winners.length > 0) {
    return lowest(winners, trump); // win as cheaply as possible
  }
  return lowest(legal, trump); // can't win — throw the lowest
}

// The seat about to play is the one not yet represented; derive from leader.
function nextToPlay(trick: Trick): PlayerIndex {
  let p = trick.leader;
  for (let i = 0; i < trick.plays.length; i++) {
    p = ((p + 1) % 4) as PlayerIndex;
  }
  return p;
}

function chooseLead(
  legal: PlayingCard[],
  _hand: PlayingCard[],
  trump: Suit,
): PlayingCard {
  // Cash an off-suit ace if we have one.
  const offAces = legal.filter(
    (c) => !isTrump(c, trump) && c.cardName === CardName.Ace,
  );
  if (offAces.length > 0) return offAces[0]!;

  // Lead the right bower to draw trump if we hold it.
  const right = legal.find((c) => isRightBower(c, trump));
  if (right) return right;

  // Otherwise lead the lowest non-trump, else the lowest trump.
  const nonTrump = legal.filter((c) => !isTrump(c, trump));
  const pool = nonTrump.length > 0 ? nonTrump : legal;
  return lowest(pool, trump);
}

function lowest(cards: PlayingCard[], trump: Suit): PlayingCard {
  return cards.reduce((lo, c) =>
    globalValue(c, trump) < globalValue(lo, trump) ? c : lo,
  );
}
