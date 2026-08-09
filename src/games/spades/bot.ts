import { type PlayingCard, CardName, Suit } from "typedeck";
import {
  type Bid,
  type PlayerIndex,
  type Trick,
  type TrickPlay,
  MAX_BID,
  NIL,
  cardStrength,
  isSpade,
  partnerOf,
  spadesRank,
  teamContract,
  teamOf,
} from "./types";
import { legalPlays } from "./trick";

const SIDE_SUITS = [Suit.Hearts, Suit.Clubs, Suit.Diamonds];

// ── Bidding ─────────────────────────────────────────────────────────────────

/** Nil looks safe: no spade above the 9, no aces, at most one king. */
function shouldBidNil(hand: readonly PlayingCard[]): boolean {
  if (hand.some((c) => isSpade(c) && spadesRank(c) > 9)) return false;
  if (hand.some((c) => c.cardName === CardName.Ace)) return false;
  const kings = hand.filter((c) => c.cardName === CardName.King).length;
  return kings <= 1;
}

/** Honest count of near-sure tricks: spade honors + length, protected side honors. */
function estimateTricks(hand: readonly PlayingCard[]): number {
  const spades = hand.filter(isSpade);
  let est = 0;
  for (const c of spades) {
    if (c.cardName === CardName.Ace) est += 1;
    else if (c.cardName === CardName.King) est += spades.length >= 2 ? 1 : 0.5;
    else if (c.cardName === CardName.Queen) est += spades.length >= 3 ? 1 : 0.5;
  }
  est += Math.max(0, spades.length - 3) * 0.5; // long trumps become ruffs

  for (const suit of SIDE_SUITS) {
    const cards = hand.filter((c) => c.suit === suit);
    if (cards.some((c) => c.cardName === CardName.Ace)) est += 1;
    // A protected king in a short-enough suit usually cashes.
    const hasKing = cards.some((c) => c.cardName === CardName.King);
    if (hasKing && cards.length >= 2 && cards.length <= 4) est += 0.5;
  }
  return est;
}

export function botBid(hand: readonly PlayingCard[]): Bid {
  if (shouldBidNil(hand)) return NIL;
  const est = Math.round(estimateTricks(hand));
  return Math.min(MAX_BID, Math.max(1, est));
}

// ── Play ────────────────────────────────────────────────────────────────────

export interface PlayContext {
  player: PlayerIndex;
  hand: PlayingCard[];
  trick: Trick; // the current trick (plays may be empty when leading)
  spadesBroken: boolean;
  bids: readonly (Bid | null)[];
  tricksByPlayer: readonly [number, number, number, number];
}

/** Cross-suit value for "highest/lowest card" choices; spades outrank all. */
function value(card: PlayingCard): number {
  return isSpade(card) ? 100 + spadesRank(card) : spadesRank(card);
}

function lowest(cards: readonly PlayingCard[]): PlayingCard {
  return cards.reduce((lo, c) => (value(c) < value(lo) ? c : lo));
}

function highest(cards: readonly PlayingCard[]): PlayingCard {
  return cards.reduce((hi, c) => (value(c) > value(hi) ? c : hi));
}

function currentWinning(trick: Trick): TrickPlay {
  const ledSuit = trick.plays[0]!.card.suit;
  return trick.plays.reduce((best, p) =>
    cardStrength(p.card, ledSuit) > cardStrength(best.card, ledSuit) ? p : best,
  );
}

function nilActive(ctx: Readonly<PlayContext>, player: PlayerIndex): boolean {
  return ctx.bids[player] === NIL && ctx.tricksByPlayer[player] === 0;
}

function contractUnmet(ctx: Readonly<PlayContext>): boolean {
  const team = teamOf(ctx.player);
  const tricks =
    ctx.tricksByPlayer[ctx.player] + ctx.tricksByPlayer[partnerOf(ctx.player)];
  return tricks < teamContract(ctx.bids, team);
}

export function botPlay(ctx: Readonly<PlayContext>): PlayingCard {
  const legal = legalPlays(ctx.hand, ctx.trick, ctx.spadesBroken);
  return ctx.trick.plays.length === 0
    ? chooseLead(legal, ctx)
    : chooseFollow(legal, ctx);
}

function chooseFollow(
  legal: PlayingCard[],
  ctx: Readonly<PlayContext>,
): PlayingCard {
  const ledSuit = ctx.trick.plays[0]!.card.suit;
  const best = currentWinning(ctx.trick);
  const bestStrength = cardStrength(best.card, ledSuit);
  const beating = legal.filter((c) => cardStrength(c, ledSuit) > bestStrength);
  const safe = legal.filter((c) => cardStrength(c, ledSuit) < bestStrength);
  const cheapestWinner = (): PlayingCard =>
    beating.reduce((lo, c) =>
      cardStrength(c, ledSuit) < cardStrength(lo, ledSuit) ? c : lo,
    );

  // Protecting our own nil: stay under the current winner if at all possible.
  if (nilActive(ctx, ctx.player)) {
    return safe.length > 0 ? highest(safe) : lowest(legal);
  }

  const partner = partnerOf(ctx.player);
  const partnerWinning = best.player === partner;

  // Protect a nil partner: overtake their winning card so they stay at zero.
  if (nilActive(ctx, partner) && partnerWinning && beating.length > 0) {
    return cheapestWinner();
  }

  if (partnerWinning) return lowest(legal); // partner has it — duck

  if (contractUnmet(ctx)) {
    return beating.length > 0 ? cheapestWinner() : lowest(legal);
  }

  // Contract met: dump a bag-safe low card, only winning when forced.
  return safe.length > 0 ? lowest(safe) : cheapestWinner();
}

function chooseLead(
  legal: PlayingCard[],
  ctx: Readonly<PlayContext>,
): PlayingCard {
  if (nilActive(ctx, ctx.player)) return lowest(legal);

  const nonSpades = legal.filter((c) => !isSpade(c));

  // Cover a nil partner by leading our strongest side card for them to duck.
  if (nilActive(ctx, partnerOf(ctx.player)) && nonSpades.length > 0) {
    return highest(nonSpades);
  }

  if (contractUnmet(ctx)) {
    const sideAce = nonSpades.find((c) => c.cardName === CardName.Ace);
    if (sideAce) return sideAce;
    const protectedKing = nonSpades.find(
      (c) =>
        c.cardName === CardName.King &&
        ctx.hand.filter((h) => h.suit === c.suit).length >= 2,
    );
    if (protectedKing) return protectedKing;
    if (nonSpades.length > 0) return highestOfLongestSuit(nonSpades, ctx.hand);
    return highest(legal); // forced to lead spades — take the trick
  }

  // Contract met: lead low, avoiding spades so we don't collect bags.
  return nonSpades.length > 0 ? lowest(nonSpades) : lowest(legal);
}

/** Lead the top of our longest side suit — strength without wasting spades. */
function highestOfLongestSuit(
  nonSpades: readonly PlayingCard[],
  hand: readonly PlayingCard[],
): PlayingCard {
  let bestSuit = nonSpades[0]!.suit;
  let bestLen = -1;
  for (const suit of SIDE_SUITS) {
    if (!nonSpades.some((c) => c.suit === suit)) continue;
    const len = hand.filter((c) => c.suit === suit).length;
    if (len > bestLen) {
      bestLen = len;
      bestSuit = suit;
    }
  }
  return highest(nonSpades.filter((c) => c.suit === bestSuit));
}
