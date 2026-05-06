import type { PlayingCard } from "typedeck";
import { handValue, isSoft } from "./game";
import { cardOrder } from "../../shared/deck";

export type Action = "hit" | "stand" | "double" | "split";

// Dealer upcard index: A=1, 2..10
function dealerIndex(upcard: PlayingCard): number {
  const o = cardOrder(upcard);
  return o >= 10 ? 10 : o;
}

// H = hit, S = stand, D = double (hit if can't), P = split
// Rows: hard totals 5-21, indexed by [total - 5]
// Columns: dealer upcard 2-10, A (index 0-9)
const HARD: string[][] = [
  //  2    3    4    5    6    7    8    9   10    A
  ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"], // 5
  ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"], // 6
  ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"], // 7
  ["H", "H", "H", "H", "H", "H", "H", "H", "H", "H"], // 8
  ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"], // 9
  ["D", "D", "D", "D", "D", "D", "D", "D", "H", "H"], // 10
  ["D", "D", "D", "D", "D", "D", "D", "D", "D", "D"], // 11
  ["H", "H", "S", "S", "S", "H", "H", "H", "H", "H"], // 12
  ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"], // 13
  ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"], // 14
  ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"], // 15
  ["S", "S", "S", "S", "S", "H", "H", "H", "H", "H"], // 16
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"], // 17
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"], // 18
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"], // 19
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"], // 20
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"], // 21
];

// Soft totals 13(A+2)..21(A+10), indexed by [total - 13]
const SOFT: string[][] = [
  //  2    3    4    5    6    7    8    9   10    A
  ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"], // 13
  ["H", "H", "H", "D", "D", "H", "H", "H", "H", "H"], // 14
  ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"], // 15
  ["H", "H", "D", "D", "D", "H", "H", "H", "H", "H"], // 16
  ["H", "D", "D", "D", "D", "H", "H", "H", "H", "H"], // 17
  ["D", "D", "D", "D", "D", "S", "S", "H", "H", "H"], // 18
  ["S", "S", "S", "S", "D", "S", "S", "S", "S", "S"], // 19
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"], // 20
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"], // 21
];

// Pair splitting: card value 1(A)..10, indexed by [value - 1]
const PAIR: string[][] = [
  //  2    3    4    5    6    7    8    9   10    A
  ["P", "P", "P", "P", "P", "P", "P", "P", "P", "P"], // A,A
  ["P", "P", "P", "P", "P", "P", "H", "H", "H", "H"], // 2,2
  ["P", "P", "P", "P", "P", "P", "H", "H", "H", "H"], // 3,3
  ["H", "H", "H", "P", "P", "H", "H", "H", "H", "H"], // 4,4
  ["D", "D", "D", "D", "D", "D", "D", "D", "H", "H"], // 5,5
  ["P", "P", "P", "P", "P", "H", "H", "H", "H", "H"], // 6,6
  ["P", "P", "P", "P", "P", "P", "H", "H", "H", "H"], // 7,7
  ["P", "P", "P", "P", "P", "P", "P", "P", "P", "P"], // 8,8
  ["P", "P", "P", "P", "P", "S", "P", "P", "S", "S"], // 9,9
  ["S", "S", "S", "S", "S", "S", "S", "S", "S", "S"], // 10,10
];

function colIndex(upcard: PlayingCard): number {
  const d = dealerIndex(upcard);
  // columns: 2,3,4,5,6,7,8,9,10,A → A maps to index 9
  return d === 1 ? 9 : d - 2;
}

export function optimalAction(
  hand: PlayingCard[],
  dealerUpcard: PlayingCard,
  canSplit: boolean,
  canDouble: boolean,
): Action {
  const col = colIndex(dealerUpcard);
  const val = handValue(hand);

  if (
    canSplit &&
    hand.length === 2 &&
    cardOrder(hand[0]!) === cardOrder(hand[1]!)
  ) {
    const pairVal = cardOrder(hand[0]!) >= 10 ? 10 : cardOrder(hand[0]!);
    const code = PAIR[pairVal - 1]?.[col] ?? "H";
    if (code === "P") return "split";
  }

  if (isSoft(hand) && val >= 13 && val <= 21) {
    const code = SOFT[val - 13]?.[col] ?? "H";
    if (code === "D") return canDouble ? "double" : "hit";
    return code === "S" ? "stand" : "hit";
  }

  const row = Math.min(Math.max(val, 5), 21) - 5;
  const code = HARD[row]?.[col] ?? "H";
  if (code === "D") return canDouble ? "double" : "hit";
  return code === "S" ? "stand" : "hit";
}
