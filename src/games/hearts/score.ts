import { CardName, PlayingCard, Suit } from "typedeck";
import {
  type PlayerIndex,
  type Trick,
  type RoundResult,
  HAND_SIZE,
  cardPoints,
  isQueenOfSpades,
} from "./types";
import { HEARTS_FAMILY, type HeartsConfig } from "./config";
import { trickWinner } from "./trick";

/** Total moon swing: every heart's value plus the Q♠ penalty. 26 in base. */
function moonValue(cfg: HeartsConfig): number {
  let total = cfg.spadePenalties.queen;
  for (let rank = CardName.Ace; rank <= CardName.King; rank++) {
    total += cfg.heartValue(new PlayingCard(rank, Suit.Hearts));
  }
  return total;
}

export function scoreRound(
  tricks: Trick[],
  cfg: HeartsConfig = HEARTS_FAMILY.base,
): RoundResult {
  const penalties = [0, 0, 0, 0];
  const bonuses = [0, 0, 0, 0];
  const heartsTaken = [0, 0, 0, 0];
  const queenTaken = [false, false, false, false];

  for (const trick of tricks) {
    const winner = trickWinner(trick);
    for (const play of trick.plays) {
      const pts = cardPoints(play.card, cfg);
      if (pts >= 0) penalties[winner]! += pts;
      else bonuses[winner]! += pts;
      if (play.card.suit === Suit.Hearts) heartsTaken[winner]!++;
      if (isQueenOfSpades(play.card)) queenTaken[winner] = true;
    }
  }

  // Shooting the moon = capturing every heart, plus the Q♠ whenever it carries
  // a penalty (so Spot Hearts needs only the hearts). Other spade penalties
  // (Black Maria's K♠/A♠) are NOT required and are wiped when someone moons —
  // the moon replaces all penalty scoring. The J♦ is a bonus: it never blocks
  // a moon and always stays with its captor (a shooter keeps its −10).
  let shotTheMoon: PlayerIndex | null = null;
  for (let i = 0; i < 4; i++) {
    if (
      heartsTaken[i] === HAND_SIZE &&
      (cfg.spadePenalties.queen === 0 || queenTaken[i])
    ) {
      shotTheMoon = i as PlayerIndex;
      break;
    }
  }

  const points = [0, 0, 0, 0];
  if (shotTheMoon !== null) {
    const swing = moonValue(cfg);
    for (let i = 0; i < 4; i++) {
      points[i] = (i === shotTheMoon ? 0 : swing) + bonuses[i]!;
    }
  } else {
    for (let i = 0; i < 4; i++) {
      points[i] = penalties[i]! + bonuses[i]!;
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
