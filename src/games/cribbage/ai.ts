import { type PlayingCard } from "typedeck";
import { scoreShowHand, scorePeggingPlay, canPlay } from "./scoring";
import { peggingValue } from "./types";

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - k; i++) {
    const rest = combinations(arr.slice(i + 1), k - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}

export function chooseDiscards(
  hand: PlayingCard[],
  isDealer: boolean,
): [number, number] {
  const combos = combinations(
    hand.map((_, i) => i),
    2,
  );
  let bestKeep: [number, number] = [0, 1];
  let bestScore = -Infinity;

  for (const discardIndices of combos) {
    const kept = hand.filter((_, i) => !discardIndices.includes(i));

    let totalScore = 0;
    let count = 0;
    for (let cn = 0; cn < 13; cn++) {
      for (let s = 0; s < 4; s++) {
        const fakeCut = { cardName: cn, suit: s } as PlayingCard;
        const isDuplicate = hand.some(
          (c) => c.cardName === fakeCut.cardName && c.suit === fakeCut.suit,
        );
        if (isDuplicate) continue;
        try {
          const result = scoreShowHand(kept, fakeCut, false);
          totalScore += result.score;
          count++;
        } catch {
          count++;
        }
      }
    }
    const avgScore = count > 0 ? totalScore / count : 0;

    const dealerBonus = isDealer ? 1 : -1;
    const discarded = discardIndices.map((i) => hand[i]);
    const fiveBonus =
      discarded.filter((c) => peggingValue(c) === 5).length *
      dealerBonus *
      -0.5;

    const score = avgScore + fiveBonus;
    if (score > bestScore) {
      bestScore = score;
      bestKeep = discardIndices as [number, number];
    }
  }

  return bestKeep;
}

export function choosePeggingCard(
  hand: PlayingCard[],
  pile: PlayingCard[],
  count: number,
): PlayingCard | null {
  const playable = hand.filter((c) => peggingValue(c) + count <= 31);
  if (playable.length === 0) return null;

  let bestCard = playable[0];
  let bestScore = -Infinity;

  for (const card of playable) {
    const newCount = count + peggingValue(card);
    const newPile = [...pile, card];
    const { points } = scorePeggingPlay(newPile, newCount);

    let score = points * 10;

    if (newCount === 15) score += 20;
    if (newCount === 31) score += 20;

    if (newCount < 5) score += 1;
    if (newCount > 21 && newCount < 31) score -= 1;

    if (peggingValue(card) === 5) score -= 3;
    if (newCount === 21) score -= 2;

    const remaining = hand.filter((c) => c !== card);
    if (!canPlay(remaining, newCount)) {
      score -= 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  }

  return bestCard;
}
