import { type PlayingCard, Suit } from "typedeck";
import {
  type PlayerIndex,
  type Trick,
  cardPoints,
  heartsRank,
  isTwoOfClubs,
} from "./types";
import { cardKey } from "../../shared/deck";

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

export function legalPlays(
  hand: PlayingCard[],
  trick: Trick | null,
  heartsBroken: boolean,
  isFirstTrickOfRound: boolean,
): PlayingCard[] {
  if (!trick || isLeading(trick)) {
    return hand.filter((c) =>
      canLead(c, hand, heartsBroken, isFirstTrickOfRound),
    );
  }
  return hand.filter((c) =>
    canFollow(c, trick.ledSuit!, hand, isFirstTrickOfRound),
  );
}

export function trickWinner(trick: Trick): PlayerIndex {
  if (trick.plays.length === 0 || trick.ledSuit === null) {
    throw new Error("Cannot determine winner of empty trick");
  }
  let winner: { player: PlayerIndex; card: PlayingCard } | null = null;
  for (const play of trick.plays) {
    if (play.card.suit !== trick.ledSuit) continue;
    if (winner === null || heartsRank(play.card) > heartsRank(winner.card)) {
      winner = play;
    }
  }
  if (!winner) return trick.plays[0]!.player;
  return winner.player;
}

export function trickPoints(trick: Trick): number {
  return trick.plays.reduce((sum, p) => sum + cardPoints(p.card), 0);
}

export function removeCardFromHand(
  hand: PlayingCard[],
  card: PlayingCard,
): PlayingCard {
  const idx = hand.findIndex((c) => cardKey(c) === cardKey(card));
  if (idx < 0) throw new Error(`Card ${cardKey(card)} not in hand`);
  return hand.splice(idx, 1)[0]!;
}
