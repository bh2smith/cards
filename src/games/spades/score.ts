import {
  type Bid,
  type HandResult,
  type NilResult,
  type Team,
  type TeamHandResult,
  BAG_LIMIT,
  BAG_PENALTY,
  LOSING_SCORE,
  NIL,
  NIL_POINTS,
  WINNING_SCORE,
} from "./types";

/**
 * Score one team's hand.
 *   made contract  → +10 × contract, +1 per overtrick (a "bag")
 *   set            → −10 × contract
 *   nil made/failed → ±100 per nil bidder; a nil bidder's tricks still count
 *                     toward the partner's contract.
 * Bags accumulate across hands; every 10th bag costs 100 (spillover kept).
 * Returns the hand result plus the team's new bag count.
 */
function scoreTeam(
  team: Team,
  bids: readonly [Bid, Bid, Bid, Bid],
  tricksByPlayer: readonly [number, number, number, number],
  bagsIn: number,
): { result: TeamHandResult; bags: number } {
  const players: [0 | 1, 2 | 3] = [team, (team + 2) as 2 | 3];

  const nils: NilResult[] = [];
  for (const p of players) {
    if (bids[p] === NIL) {
      const made = tricksByPlayer[p] === 0;
      nils.push({
        player: p,
        made,
        points: made ? NIL_POINTS : -NIL_POINTS,
      });
    }
  }

  const contract = bids[players[0]] + bids[players[1]];
  const tricks = tricksByPlayer[players[0]] + tricksByPlayer[players[1]];
  const made = tricks >= contract;
  const contractPoints = made ? 10 * contract : -10 * contract;
  const bagsAdded = made ? tricks - contract : 0;

  let bags = bagsIn + bagsAdded;
  let bagPenalties = 0;
  while (bags >= BAG_LIMIT) {
    bagPenalties++;
    bags -= BAG_LIMIT;
  }

  const nilPoints = nils.reduce((sum, n) => sum + n.points, 0);
  const total =
    contractPoints + bagsAdded - bagPenalties * BAG_PENALTY + nilPoints;

  return {
    result: {
      contract,
      tricks,
      made,
      contractPoints,
      bagsAdded,
      bagPenalties,
      nils,
      total,
    },
    bags,
  };
}

export function scoreHand(
  bids: readonly [Bid, Bid, Bid, Bid],
  tricksByPlayer: readonly [number, number, number, number],
  bagsIn: readonly [number, number],
): { result: HandResult; bags: [number, number] } {
  const t0 = scoreTeam(0, bids, tricksByPlayer, bagsIn[0]);
  const t1 = scoreTeam(1, bids, tricksByPlayer, bagsIn[1]);
  return {
    result: { teams: [t0.result, t1.result] },
    bags: [t0.bags, t1.bags],
  };
}

/**
 * Game end: first team to 500 wins; first team to −200 loses. If both cross a
 * threshold on the same hand, the higher total wins (an exact tie plays on).
 */
export function gameWinner(scores: readonly [number, number]): Team | null {
  const higher: Team | null =
    scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
  const won0 = scores[0] >= WINNING_SCORE;
  const won1 = scores[1] >= WINNING_SCORE;
  if (won0 && won1) return higher;
  if (won0) return 0;
  if (won1) return 1;
  const lost0 = scores[0] <= LOSING_SCORE;
  const lost1 = scores[1] <= LOSING_SCORE;
  if (lost0 && lost1) return higher;
  if (lost0) return 1;
  if (lost1) return 0;
  return null;
}
