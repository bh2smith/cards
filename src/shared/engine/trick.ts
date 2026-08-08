import type { PlayingCard, Suit } from "typedeck";
import { cardKey } from "../deck";

export interface TrickPlay<P extends number = number> {
  player: P;
  card: PlayingCard;
}

/**
 * Game-specific hooks for the generic trick engine.
 * - effectiveSuit: the suit a card plays as (e.g. euchre's left bower plays as trump).
 * - strength: comparable value within a trick, given the led (effective) suit.
 *   Cards that cannot win should return a value below every winnable card.
 * - mayPlay: optional extra constraint applied after the follow-suit filter
 *   (e.g. hearts' "no points on the first trick"). `canFollow` is whether the
 *   hand holds the led suit; when leading, `ledSuit` is null.
 */
export interface TrickRules {
  effectiveSuit(card: PlayingCard): Suit;
  strength(card: PlayingCard, ledSuit: Suit): number;
  mayPlay?(
    card: PlayingCard,
    ctx: { hand: PlayingCard[]; ledSuit: Suit | null; canFollow: boolean },
  ): boolean;
}

/**
 * Legal plays for a hand. Leading (ledCard null): any card passing mayPlay.
 * Following: must follow the led effective suit if able, otherwise any card,
 * subject to mayPlay.
 */
export function legalPlays(
  hand: PlayingCard[],
  ledCard: PlayingCard | null,
  rules: TrickRules,
): PlayingCard[] {
  const ledSuit = ledCard ? rules.effectiveSuit(ledCard) : null;
  const canFollow =
    ledSuit !== null && hand.some((c) => rules.effectiveSuit(c) === ledSuit);
  const base = canFollow
    ? hand.filter((c) => rules.effectiveSuit(c) === ledSuit)
    : [...hand];
  const may = rules.mayPlay;
  if (!may) return base;
  return base.filter((c) => may(c, { hand, ledSuit, canFollow }));
}

/**
 * The winning play of a completed (or in-progress) trick. The led suit is
 * derived from the first play unless the game tracks it separately.
 */
export function trickWinner<P extends number>(
  plays: TrickPlay<P>[],
  rules: TrickRules,
  ledSuitOverride?: Suit,
): P {
  if (plays.length === 0) {
    throw new Error("Cannot determine winner of empty trick");
  }
  const ledSuit = ledSuitOverride ?? rules.effectiveSuit(plays[0]!.card);
  let best = plays[0]!;
  let bestStrength = rules.strength(best.card, ledSuit);
  for (const play of plays.slice(1)) {
    const s = rules.strength(play.card, ledSuit);
    if (s > bestStrength) {
      bestStrength = s;
      best = play;
    }
  }
  return best.player;
}

export function removeCardFromHand(
  hand: PlayingCard[],
  card: PlayingCard,
): PlayingCard {
  const idx = hand.findIndex((c) => cardKey(c) === cardKey(card));
  if (idx < 0) throw new Error(`Card ${cardKey(card)} not in hand`);
  return hand.splice(idx, 1)[0]!;
}
