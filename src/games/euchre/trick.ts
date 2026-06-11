import { type PlayingCard, Suit } from "typedeck";
import {
  type PlayerIndex,
  type Trick,
  cardStrength,
  effectiveSuit,
} from "./types";
import { cardKey } from "../../shared/deck";

/**
 * Legal plays for a hand. Leading: anything. Following: must follow the led
 * (effective) suit if able, otherwise anything. The left bower counts as trump,
 * not as its printed suit.
 */
export function legalPlays(
  hand: PlayingCard[],
  trick: Trick | null,
  trump: Suit,
): PlayingCard[] {
  if (!trick || trick.plays.length === 0) return [...hand];
  const ledSuit = effectiveSuit(trick.plays[0]!.card, trump);
  const canFollow = hand.filter((c) => effectiveSuit(c, trump) === ledSuit);
  return canFollow.length > 0 ? canFollow : [...hand];
}

/** The winning player of a completed (or in-progress) trick. */
export function trickWinner(trick: Trick, trump: Suit): PlayerIndex {
  if (trick.plays.length === 0) {
    throw new Error("Cannot determine winner of empty trick");
  }
  const ledSuit = effectiveSuit(trick.plays[0]!.card, trump);
  let best = trick.plays[0]!;
  let bestStrength = cardStrength(best.card, trump, ledSuit);
  for (const play of trick.plays.slice(1)) {
    const s = cardStrength(play.card, trump, ledSuit);
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
