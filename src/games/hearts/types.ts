import { type PlayingCard, CardName, Suit } from "typedeck";

export type PlayerIndex = 0 | 1 | 2 | 3;

export type HeartsPhase = "PASSING" | "PLAYING" | "ROUND_OVER" | "GAME_OVER";

export type PassDirection = "left" | "right" | "across" | "hold";

export interface TrickPlay {
  player: PlayerIndex;
  card: PlayingCard;
}

export interface Trick {
  leader: PlayerIndex;
  ledSuit: Suit | null;
  plays: TrickPlay[];
}

export interface RoundResult {
  pointsByPlayer: number[];
  shotTheMoon: PlayerIndex | null;
}

export interface HeartsState {
  phase: HeartsPhase;
  message: string;
  hands: PlayingCard[][];
  scores: number[];
  roundScores: number[];
  voidSuits: Set<Suit>[];
  passDirection: PassDirection;
  pendingPasses: (number[] | null)[];
  heartsBroken: boolean;
  currentTrick: Trick | null;
  completedTricks: Trick[];
  currentTurn: PlayerIndex;
  roundNumber: number;
  roundResult: RoundResult | null;
  winner: PlayerIndex | null;
}

export const WINNING_SCORE = 100;
export const HAND_SIZE = 13;
export const PASS_DIRECTIONS: PassDirection[] = [
  "left",
  "right",
  "across",
  "hold",
];

export function passDirectionForRound(roundNumber: number): PassDirection {
  return PASS_DIRECTIONS[(roundNumber - 1) % 4]!;
}

export function passTarget(
  from: PlayerIndex,
  direction: PassDirection,
): PlayerIndex | null {
  switch (direction) {
    case "left":
      return ((from + 1) % 4) as PlayerIndex;
    case "right":
      return ((from + 3) % 4) as PlayerIndex;
    case "across":
      return ((from + 2) % 4) as PlayerIndex;
    case "hold":
      return null;
  }
}

export function heartsRank(card: PlayingCard): number {
  return card.cardName === CardName.Ace ? 14 : card.cardName;
}

export function isQueenOfSpades(card: PlayingCard): boolean {
  return card.suit === Suit.Spades && card.cardName === CardName.Queen;
}

export function isTwoOfClubs(card: PlayingCard): boolean {
  return card.suit === Suit.Clubs && card.cardName === CardName.Two;
}

export function cardPoints(card: PlayingCard): number {
  if (card.suit === Suit.Hearts) return 1;
  if (isQueenOfSpades(card)) return 13;
  return 0;
}

export function sortByHearts(hand: PlayingCard[]): void {
  const order: Record<number, number> = {
    [Suit.Clubs]: 0,
    [Suit.Diamonds]: 1,
    [Suit.Spades]: 2,
    [Suit.Hearts]: 3,
  };
  hand.sort(
    (a, b) => order[a.suit]! - order[b.suit]! || heartsRank(a) - heartsRank(b),
  );
}
