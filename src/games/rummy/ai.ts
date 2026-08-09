import type { PlayingCard } from "typedeck";
import { cardOrder } from "../../shared/deck";
import { deadwoodValue, findBestMelds } from "../../shared/engine/melds";
import type { RummyConfig } from "./config";
import {
  bestMeldContaining,
  extendMeld,
  handCardValue,
  meldValue,
  pipValue,
} from "./rules";
import type { TableMeld } from "./types";

/** Deadwood level at which the bot knocks (Knock Rummy). */
export const BOT_KNOCK_GOAL = 10;

export type DrawChoice =
  | { source: "stock" }
  | { source: "discard"; depth: number };

function bestDeadwood(hand: PlayingCard[], cfg: RummyConfig): number {
  const value = (c: PlayingCard) => handCardValue(c, cfg);
  return deadwoodValue(
    findBestMelds(hand, value, cfg.runOptions).deadwood,
    value,
  );
}

/** Lowest deadwood achievable after drawing `card` and discarding one card. */
function deadwoodAfterTaking(
  hand: PlayingCard[],
  card: PlayingCard,
  cfg: RummyConfig,
): number {
  const withCard = [...hand, card];
  let best = Infinity;
  for (let i = 0; i < withCard.length; i++) {
    const dw = bestDeadwood(
      withCard.filter((_, j) => j !== i),
      cfg,
    );
    if (dw < best) best = dw;
  }
  return best;
}

export function botChooseDraw(
  hand: PlayingCard[],
  discardPile: readonly PlayingCard[],
  cfg: RummyConfig,
): DrawChoice {
  if (discardPile.length === 0) return { source: "stock" };
  const top = discardPile.length - 1;

  // 500 Rum: dig into the discard row when the immediate meld pays for the
  // extra cards swallowed along the way (5 points of meld per extra card).
  if (cfg.discardPickup === "any") {
    let best: { depth: number; score: number } | null = null;
    for (let depth = 0; depth <= top; depth++) {
      const taken = discardPile.slice(depth);
      const extra = taken.length - 1;
      const target = taken[0]!;
      const meld = bestMeldContaining([...hand, ...taken], target, cfg);
      if (!meld) continue;
      const worth = meldValue(meld, cfg);
      if (worth < extra * 5) continue;
      const score = worth - extra * 5;
      if (!best || score > best.score) best = { depth, score };
    }
    if (best) return { source: "discard", depth: best.depth };
  }

  const topCard = discardPile[top]!;
  if (deadwoodAfterTaking(hand, topCard, cfg) < bestDeadwood(hand, cfg)) {
    return { source: "discard", depth: top };
  }
  return { source: "stock" };
}

/** Whether discarding `card` hands the opponent something they showed interest in. */
function isDangerous(
  card: PlayingCard,
  opponentPickups: readonly PlayingCard[],
): boolean {
  return opponentPickups.some(
    (p) =>
      p.cardName === card.cardName ||
      (p.suit === card.suit && Math.abs(cardOrder(p) - cardOrder(card)) <= 2),
  );
}

/**
 * The discard minimizing remaining deadwood; among ties, avoid cards the
 * opponent has shown interest in, then dump the highest pip value.
 */
export function botChooseDiscard(
  hand: PlayingCard[],
  cfg: RummyConfig,
  opponentPickups: readonly PlayingCard[],
): number {
  let bestIdx = 0;
  let bestScore = Infinity;
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i]!;
    const dw = bestDeadwood(
      hand.filter((_, j) => j !== i),
      cfg,
    );
    const danger = isDangerous(card, opponentPickups) ? 1 : 0;
    const score = dw * 1000 + danger * 100 + (20 - pipValue(card));
    if (score < bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function botShouldKnock(deadwood: number): boolean {
  return deadwood <= BOT_KNOCK_GOAL;
}

/** Table melds (by index) a card could lay off onto. */
export function layOffTargets(
  card: PlayingCard,
  tableMelds: readonly TableMeld[],
  cfg: RummyConfig,
): number[] {
  if (!cfg.layOffAllowed || !cfg.meldsOnTable) return [];
  const out: number[] = [];
  for (let i = 0; i < tableMelds.length; i++) {
    if (extendMeld(tableMelds[i]!, card, cfg.runOptions)) out.push(i);
  }
  return out;
}
