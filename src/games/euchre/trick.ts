import { type PlayingCard, Suit } from "typedeck";
import {
  type PlayerIndex,
  type Trick,
  cardStrength,
  effectiveSuit,
} from "./types";
import {
  legalPlays as coreLegalPlays,
  trickWinner as coreTrickWinner,
  removeCardFromHand,
  type TrickRules,
} from "../../shared/engine/trick";

export { removeCardFromHand };

function euchreRules(trump: Suit): TrickRules {
  return {
    effectiveSuit: (card) => effectiveSuit(card, trump),
    strength: (card, ledSuit) => cardStrength(card, trump, ledSuit),
  };
}

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
  const ledCard = trick?.plays[0]?.card ?? null;
  return coreLegalPlays(hand, ledCard, euchreRules(trump));
}

/** The winning player of a completed (or in-progress) trick. */
export function trickWinner(trick: Trick, trump: Suit): PlayerIndex {
  return coreTrickWinner(trick.plays, euchreRules(trump));
}
