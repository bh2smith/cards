import {
  type PlayerIndex,
  type Trick,
  type RoundResult,
  cardPoints,
} from "./types";
import { trickWinner } from "./trick";

export function scoreRound(tricks: Trick[]): RoundResult {
  const points = [0, 0, 0, 0];
  for (const trick of tricks) {
    const winner = trickWinner(trick);
    for (const play of trick.plays) {
      points[winner]! += cardPoints(play.card);
    }
  }

  let shotTheMoon: PlayerIndex | null = null;
  for (let i = 0; i < 4; i++) {
    if (points[i] === 26) {
      shotTheMoon = i as PlayerIndex;
      break;
    }
  }

  if (shotTheMoon !== null) {
    for (let i = 0; i < 4; i++) {
      points[i] = i === shotTheMoon ? 0 : 26;
    }
  }

  return { pointsByPlayer: points, shotTheMoon };
}

export function gameWinner(
  scores: number[],
  threshold: number,
): PlayerIndex | null {
  const someoneAtThreshold = scores.some((s) => s >= threshold);
  if (!someoneAtThreshold) return null;
  let lowest = Infinity;
  let winners: PlayerIndex[] = [];
  for (let i = 0; i < 4; i++) {
    const s = scores[i]!;
    if (s < lowest) {
      lowest = s;
      winners = [i as PlayerIndex];
    } else if (s === lowest) {
      winners.push(i as PlayerIndex);
    }
  }
  return winners[0]!;
}
