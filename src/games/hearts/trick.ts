import { type PlayingCard, Suit } from "typedeck";
import {
  type PlayerIndex,
  type Trick,
  cardPoints,
  heartsRank,
  isTwoOfClubs,
} from "./types";
import {
  legalPlays as coreLegalPlays,
  trickWinner as coreTrickWinner,
  removeCardFromHand,
  type TrickRules,
} from "../../shared/engine/trick";

export { removeCardFromHand };

export function isLeading(trick: Trick): boolean {
  return trick.plays.length === 0;
}

export function canLead(
  card: PlayingCard,
  hand: PlayingCard[],
  heartsBroken: boolean,
  isFirstTrickOfRound: boolean,
): boolean {
  if (isFirstTrickOfRound) {
    return isTwoOfClubs(card);
  }
  if (card.suit !== Suit.Hearts) return true;
  if (heartsBroken) return true;
  return hand.every((c) => c.suit === Suit.Hearts);
}

export function canFollow(
  card: PlayingCard,
  ledSuit: Suit,
  hand: PlayingCard[],
  isFirstTrickOfRound: boolean,
): boolean {
  const hasLed = hand.some((c) => c.suit === ledSuit);
  if (hasLed) {
    return card.suit === ledSuit;
  }
  if (isFirstTrickOfRound && cardPoints(card) > 0) {
    const onlyPoints = hand.every((c) => cardPoints(c) > 0);
    if (!onlyPoints) return false;
  }
  return true;
}

function heartsRules(
  heartsBroken: boolean,
  isFirstTrickOfRound: boolean,
): TrickRules {
  return {
    effectiveSuit: (card) => card.suit,
    strength: (card, ledSuit) =>
      card.suit === ledSuit ? heartsRank(card) : -1,
    mayPlay: (card, { hand, ledSuit, canFollow: hasLed }) => {
      if (ledSuit === null) {
        return canLead(card, hand, heartsBroken, isFirstTrickOfRound);
      }
      if (hasLed) return true;
      if (isFirstTrickOfRound && cardPoints(card) > 0) {
        return hand.every((c) => cardPoints(c) > 0);
      }
      return true;
    },
  };
}

export function legalPlays(
  hand: PlayingCard[],
  trick: Trick | null,
  heartsBroken: boolean,
  isFirstTrickOfRound: boolean,
): PlayingCard[] {
  const ledCard = trick && !isLeading(trick) ? trick.plays[0]!.card : null;
  return coreLegalPlays(
    hand,
    ledCard,
    heartsRules(heartsBroken, isFirstTrickOfRound),
  );
}

export function trickWinner(trick: Trick): PlayerIndex {
  if (trick.plays.length === 0 || trick.ledSuit === null) {
    throw new Error("Cannot determine winner of empty trick");
  }
  return coreTrickWinner(trick.plays, heartsRules(false, false), trick.ledSuit);
}

export function trickPoints(trick: Trick): number {
  return trick.plays.reduce((sum, p) => sum + cardPoints(p.card), 0);
}
