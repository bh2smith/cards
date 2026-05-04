import { type PlayingCard } from "typedeck";
import { scoreHand } from "cribbage-counter";
import {
  toCounterString,
  peggingValue,
  cardOrder,
  type ScoreResult,
} from "./types";

export function scoreShowHand(
  hand: PlayingCard[],
  starter: PlayingCard,
  isCrib: boolean,
): ScoreResult {
  const handStr = hand.map(toCounterString).join(",");
  const starterStr = toCounterString(starter);
  return scoreHand(`${handStr},${starterStr}`, isCrib);
}

export function checkHisHeels(starter: PlayingCard): boolean {
  return starter.cardName === 10; // CardName.Jack = 10
}

// -- Pegging scoring --

export function scorePeggingPlay(
  pile: PlayingCard[],
  count: number,
): { points: number; details: string[] } {
  if (pile.length === 0) return { points: 0, details: [] };

  let points = 0;
  const details: string[] = [];

  if (count === 15) {
    points += 2;
    details.push("Fifteen for 2");
  }
  if (count === 31) {
    points += 2;
    details.push("Thirty-one for 2");
  }

  const pairPoints = scorePeggingPairs(pile);
  if (pairPoints > 0) {
    points += pairPoints;
    if (pairPoints === 2) details.push("Pair for 2");
    else if (pairPoints === 6) details.push("Three of a kind for 6");
    else if (pairPoints === 12) details.push("Four of a kind for 12");
  }

  const runPoints = scorePeggingRun(pile);
  if (runPoints > 0) {
    points += runPoints;
    details.push(`Run of ${runPoints} for ${runPoints}`);
  }

  return { points, details };
}

function scorePeggingPairs(pile: PlayingCard[]): number {
  if (pile.length < 2) return 0;
  const last = pile[pile.length - 1];
  let matchCount = 0;
  for (let i = pile.length - 2; i >= 0; i--) {
    if (pile[i].cardName === last.cardName) {
      matchCount++;
    } else {
      break;
    }
  }
  if (matchCount === 1) return 2;
  if (matchCount === 2) return 6;
  if (matchCount === 3) return 12;
  return 0;
}

function scorePeggingRun(pile: PlayingCard[]): number {
  if (pile.length < 3) return 0;

  for (let len = Math.min(pile.length, 7); len >= 3; len--) {
    const lastN = pile.slice(pile.length - len);
    const orders = lastN.map(cardOrder).sort((a, b) => a - b);
    let isRun = true;
    for (let i = 1; i < orders.length; i++) {
      if (orders[i] !== orders[i - 1] + 1) {
        isRun = false;
        break;
      }
    }
    if (isRun) return len;
  }
  return 0;
}

export function canPlay(hand: PlayingCard[], count: number): boolean {
  return hand.some((card) => peggingValue(card) + count <= 31);
}
