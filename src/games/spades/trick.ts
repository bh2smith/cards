import { type PlayingCard } from "typedeck";
import { type PlayerIndex, type Trick, cardStrength, isSpade } from "./types";
import {
  legalPlays as coreLegalPlays,
  trickWinner as coreTrickWinner,
  removeCardFromHand,
  type TrickRules,
} from "../../shared/engine/trick";

export { removeCardFromHand };

function spadesRules(spadesBroken: boolean): TrickRules {
  return {
    effectiveSuit: (card) => card.suit,
    strength: (card, ledSuit) => cardStrength(card, ledSuit),
    mayPlay: (card, { hand, ledSuit }) => {
      // The broken-spades restriction only applies to LEADING a spade.
      if (ledSuit !== null) return true;
      if (!isSpade(card)) return true;
      if (spadesBroken) return true;
      return hand.every(isSpade); // spades-only hands may lead them anyway
    },
  };
}

/**
 * Legal plays. Leading: any card, except spades may not be led until broken
 * (unless the hand is spades-only). Following: must follow suit if able.
 */
export function legalPlays(
  hand: PlayingCard[],
  trick: Trick | null,
  spadesBroken: boolean,
): PlayingCard[] {
  const ledCard = trick?.plays[0]?.card ?? null;
  return coreLegalPlays(hand, ledCard, spadesRules(spadesBroken));
}

/** The winning player of a completed (or in-progress) trick. */
export function trickWinner(trick: Trick): PlayerIndex {
  return coreTrickWinner(trick.plays, spadesRules(true));
}
