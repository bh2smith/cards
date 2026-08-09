import { type HandResult, type PlayerIndex } from "./types";

/**
 * Score a completed partnership hand from the makers' trick count.
 *   makers take 3 or 4 tricks      → makers +1
 *   makers take all 5 (march)      → makers +2  (or +4 if going alone)
 *   makers take fewer than 3       → defenders +2  (euchred)
 */
export function scoreHand(
  trickWins: number[],
  makerTeam: number,
  maker: number,
  alone: boolean,
): HandResult {
  const made = trickWins[makerTeam]!;
  const defenders = makerTeam === 0 ? 1 : 0;

  let scoringTeam: number;
  let points: number;
  let kind: HandResult["kind"];

  if (made >= 3) {
    scoringTeam = makerTeam;
    if (made === 5) {
      points = alone ? 4 : 2;
      kind = alone ? "alone-march" : "march";
    } else {
      points = 1;
      kind = "made";
    }
  } else {
    scoringTeam = defenders;
    points = 2;
    kind = "euchre";
  }

  return {
    makerTeam,
    maker: maker as HandResult["maker"],
    alone,
    trickWins,
    scoringTeam,
    points,
    awards: [{ side: scoringTeam, points }],
    kind,
  };
}

/**
 * Score a completed cutthroat hand. The maker plays alone against the other
 * two in temporary alliance; sides are individual players.
 *   maker takes 3 or 4 tricks → maker +1
 *   maker takes all 5 (march) → maker +3
 *   maker takes fewer than 3  → EACH defender +2  (euchred)
 */
export function scoreCutthroatHand(
  trickWins: number[],
  maker: PlayerIndex,
): HandResult {
  const made = trickWins[maker]!;

  let awards: HandResult["awards"];
  let kind: HandResult["kind"];

  if (made >= 3) {
    awards = [{ side: maker, points: made === 5 ? 3 : 1 }];
    kind = made === 5 ? "march" : "made";
  } else {
    awards = trickWins
      .map((_, side) => side)
      .filter((side) => side !== maker)
      .map((side) => ({ side, points: 2 }));
    kind = "euchre";
  }

  return {
    makerTeam: maker,
    maker,
    alone: false,
    trickWins,
    scoringTeam: awards[0]!.side,
    points: awards[0]!.points,
    awards,
    kind,
  };
}

/** The winning side, or null. On a simultaneous crossing the higher score wins. */
export function gameWinner(scores: number[], threshold: number): number | null {
  let winner: number | null = null;
  for (let side = 0; side < scores.length; side++) {
    if (scores[side]! < threshold) continue;
    if (winner === null || scores[side]! > scores[winner]!) winner = side;
  }
  return winner;
}
