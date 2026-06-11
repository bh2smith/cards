import { type HandResult, type Team } from "./types";

/**
 * Score a completed hand from the makers' trick count.
 *   makers take 3 or 4 tricks      → makers +1
 *   makers take all 5 (march)      → makers +2  (or +4 if going alone)
 *   makers take fewer than 3       → defenders +2  (euchred)
 */
export function scoreHand(
  trickWins: [number, number],
  makerTeam: Team,
  maker: number,
  alone: boolean,
): HandResult {
  const made = trickWins[makerTeam];
  const defenders: Team = makerTeam === 0 ? 1 : 0;

  let scoringTeam: Team;
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
    kind,
  };
}

export function gameWinner(
  scores: [number, number],
  threshold: number,
): Team | null {
  if (scores[0] >= threshold) return 0;
  if (scores[1] >= threshold) return 1;
  return null;
}
