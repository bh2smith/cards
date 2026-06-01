import { CardName, type PlayingCard } from "typedeck";
import type { Player } from "../../shared/types";
import { cardKey } from "../../shared/deck";
import {
  type CuttleState,
  type FieldCard,
  cardActions,
  pointValue,
  pointTotal,
  winThreshold,
  opponentOf,
  isTwo,
  isEight,
  isKing,
  isQueen,
} from "./types";

export type BotAction =
  | { type: "points"; key: string }
  | { type: "scuttle"; key: string; targetKey: string }
  | { type: "oneoff"; key: string; targetKey?: string }
  | { type: "glasses"; key: string }
  | { type: "jack"; key: string; targetKey: string }
  | { type: "king"; key: string }
  | { type: "queen"; key: string }
  | { type: "draw" }
  | { type: "pass" };

interface Scored {
  action: BotAction;
  score: number;
}

/** How much we value keeping a card (used for discards and scrap digging). */
function cardWorth(card: PlayingCard): number {
  if (isKing(card) || isQueen(card)) return 14;
  if (card.cardName === CardName.Ace) return 12;
  if (isTwo(card)) return 11; // counters are precious
  if (card.cardName === CardName.Jack) return 10;
  if (card.cardName === CardName.Six || card.cardName === CardName.Nine)
    return 9;
  return pointValue(card); // plain number cards
}

function royalCount(field: {
  kings: FieldCard[];
  queens: FieldCard[];
  glasses: FieldCard[];
}): number {
  return field.kings.length + field.queens.length + field.glasses.length;
}

function findFieldCard(state: CuttleState, key: string): FieldCard | undefined {
  for (const p of ["player", "computer"] as Player[]) {
    const f = state.fields[p];
    const hit = [...f.points, ...f.queens, ...f.kings, ...f.glasses].find(
      (fc) => cardKey(fc.card) === key,
    );
    if (hit) return hit;
  }
  return undefined;
}

/** Score (and pick a target for) a one-off, from `by`'s perspective. */
function oneOffScore(
  state: CuttleState,
  by: Player,
  card: PlayingCard,
  targets: FieldCard[],
): { score: number; targetKey?: string } | null {
  const opp = opponentOf(by);
  const myTotal = pointTotal(state.fields[by]);
  const theirTotal = pointTotal(state.fields[opp]);

  switch (card.cardName) {
    case CardName.Ace:
      return theirTotal > myTotal && theirTotal >= 8
        ? { score: 20 + (theirTotal - myTotal) }
        : { score: -50 };
    case CardName.Two: {
      // Prefer destroying a King, then glasses, then a Queen.
      const pick =
        targets.find((t) => isKing(t.card)) ??
        targets.find((t) => isEight(t.card)) ??
        targets[0];
      if (!pick) return null;
      const score = isKing(pick.card) ? 24 : isEight(pick.card) ? 16 : 14;
      return { score, targetKey: cardKey(pick.card) };
    }
    case CardName.Three: {
      let best: PlayingCard | null = null;
      for (const c of state.scrap)
        if (!best || cardWorth(c) > cardWorth(best)) best = c;
      if (!best) return { score: -50 };
      const small = state.hands[by].length <= 3;
      return {
        score: (small ? 6 : 2) + cardWorth(best) * 0.4,
        targetKey: cardKey(best),
      };
    }
    case CardName.Four:
      return { score: state.hands[opp].length >= 5 ? 11 : 3 };
    case CardName.Five:
      return {
        score: state.hands[by].length <= 2 && state.deck.length > 0 ? 13 : 4,
      };
    case CardName.Six: {
      const mine = royalCount(state.fields[by]);
      const theirs = royalCount(state.fields[opp]);
      return {
        score: theirs >= 2 && theirs > mine ? 17 : mine > theirs ? -30 : 2,
      };
    }
    case CardName.Seven:
      return { score: 9 };
    case CardName.Nine: {
      const king = targets.find((t) => isKing(t.card));
      if (king) return { score: 22, targetKey: cardKey(king.card) };
      const point = targets
        .filter((t) => state.fields[opp].points.includes(t))
        .sort((a, b) => pointValue(b.card) - pointValue(a.card))[0];
      if (point)
        return {
          score: 10 + pointValue(point.card),
          targetKey: cardKey(point.card),
        };
      const royal = targets[0];
      return royal ? { score: 11, targetKey: cardKey(royal.card) } : null;
    }
    default:
      return null;
  }
}

/** The strongest single thing `card` could do this turn, or null if nothing. */
function bestActionForCard(
  state: CuttleState,
  by: Player,
  card: PlayingCard,
): Scored | null {
  const me = state.fields[by];
  const myTotal = pointTotal(me);
  const myThresh = winThreshold(me.kings.length);
  const a = cardActions(state, by, card);
  const key = cardKey(card);
  let best: Scored | null = null;
  const consider = (action: BotAction, score: number) => {
    if (!best || score > best.score) best = { action, score };
  };

  if (a.points) {
    const v = pointValue(card);
    const win = myTotal + v >= myThresh;
    let score = 6 + v;
    // Don't squander cards that are far more valuable kept for their effect.
    if (card.cardName === CardName.Ace) score -= 6;
    else if (isTwo(card)) score -= 7;
    else if (card.cardName === CardName.Six || card.cardName === CardName.Nine)
      score -= 4;
    consider({ type: "points", key }, win ? 1e6 : score);
  }
  for (const t of a.scuttle) {
    consider(
      { type: "scuttle", key, targetKey: cardKey(t.card) },
      18 + pointValue(t.card) * 1.5,
    );
  }
  for (const t of a.jack) {
    const win = myTotal + pointValue(t.card) >= myThresh;
    consider(
      { type: "jack", key, targetKey: cardKey(t.card) },
      win ? 1e6 : 14 + pointValue(t.card) * 1.8,
    );
  }
  if (a.king) {
    const newThresh = winThreshold(me.kings.length + 1);
    consider(
      { type: "king", key },
      myTotal >= newThresh ? 1e6 : 10 + myTotal * 0.4,
    );
  }
  if (a.queen)
    consider({ type: "queen", key }, 7 + (me.points.length > 0 ? 4 : 0));
  if (a.glasses) consider({ type: "glasses", key }, 5);
  if (a.oneOff.playable) {
    const s = oneOffScore(state, by, card, a.oneOff.targets);
    if (s && s.score > -50)
      consider({ type: "oneoff", key, targetKey: s.targetKey }, s.score);
  }
  return best;
}

/** Cards in `by`'s hand that are not frozen by a Nine this turn. */
function liveHand(state: CuttleState, by: Player): PlayingCard[] {
  return state.hands[by].filter(
    (c) => !(state.frozenOwner === by && state.frozenKey === cardKey(c)),
  );
}

export function chooseBotAction(state: CuttleState): BotAction {
  const by: Player = "computer";
  let best: Scored | null = null;
  for (const card of liveHand(state, by)) {
    const s = bestActionForCard(state, by, card);
    if (s && (!best || s.score > best.score)) best = s;
  }

  const canDraw = state.deck.length > 0 && state.hands[by].length < 8;
  // Draw is the safe default; only override it when a play clears the bar.
  if (best && best.score >= 6) return best.action;
  if (canDraw) return { type: "draw" };
  if (best) return best.action; // deck empty — take whatever we have
  return { type: "pass" };
}

/** Decide whether to spend a Two on the pending one-off; return its hand index. */
export function chooseCounter(
  state: CuttleState,
  decider: Player,
): number | null {
  const twoIdx = state.hands[decider].findIndex(isTwo);
  if (twoIdx < 0 || !state.oneOff) return null;

  const flight = state.oneOff;
  const base = flight.stack[0]!;
  const resolvesIfPass = (flight.stack.length - 1) % 2 === 0;
  const benefit = casterBenefit(state, base, flight.by, flight.targetKey);
  const FORCE = 14;

  if (decider === flight.by) {
    // We cast it and want it to land — push through a counter if it's worth it.
    return !resolvesIfPass && benefit >= FORCE ? twoIdx : null;
  }
  // We're the target — negate it if it would otherwise resolve and it hurts.
  return resolvesIfPass && benefit >= FORCE ? twoIdx : null;
}

/** How much the base one-off resolving benefits its caster (= harm to target). */
function casterBenefit(
  state: CuttleState,
  base: PlayingCard,
  by: Player,
  targetKey: string | null,
): number {
  const opp = opponentOf(by);
  const myTotal = pointTotal(state.fields[by]);
  const theirTotal = pointTotal(state.fields[opp]);
  switch (base.cardName) {
    case CardName.Ace:
      return Math.max(0, theirTotal - myTotal);
    case CardName.Two: {
      const t = targetKey ? findFieldCard(state, targetKey) : undefined;
      if (!t) return 0;
      return isKing(t.card) ? 24 : isEight(t.card) ? 16 : 14;
    }
    case CardName.Six: {
      const mine = royalCount(state.fields[by]);
      const theirs = royalCount(state.fields[opp]);
      return Math.max(0, theirs - mine) * 8;
    }
    case CardName.Nine: {
      const t = targetKey ? findFieldCard(state, targetKey) : undefined;
      if (!t) return 0;
      if (isKing(t.card)) return 18;
      if (isQueen(t.card)) return 12;
      return pointValue(t.card) >= 7 ? pointValue(t.card) + 4 : 6;
    }
    case CardName.Four:
      return state.hands[opp].length >= 5 ? 11 : 4;
    default:
      return 0; // Three, Five, Seven — rarely worth a counter war
  }
}

/** Pick `count` weakest cards to discard for a Four; returns hand indices. */
export function chooseDiscards(hand: PlayingCard[], count: number): number[] {
  return hand
    .map((card, i) => ({ i, worth: cardWorth(card) }))
    .sort((a, b) => a.worth - b.worth)
    .slice(0, count)
    .map((x) => x.i);
}

/** Choose which of the two revealed Seven cards to play, and how. */
export function chooseSeven(
  state: CuttleState,
  by: Player,
  cards: PlayingCard[],
): { key: string; action: BotAction } | null {
  let best: { key: string; action: BotAction; score: number } | null = null;
  for (const card of cards) {
    const s = bestActionForCard(state, by, card);
    if (s && (!best || s.score > best.score))
      best = { key: cardKey(card), action: s.action, score: s.score };
  }
  return best ? { key: best.key, action: best.action } : null;
}
