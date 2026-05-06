import type { PlayingCard } from "typedeck";
import { cardKey } from "../../shared/deck";
import { calculateDeadwood } from "./melds";
import { KNOCK_THRESHOLD } from "./types";

export function botChooseDraw(
  hand: PlayingCard[],
  discardTop: PlayingCard,
): "stock" | "discard" {
  const currentDw = calculateDeadwood(hand);
  const withDiscard = [...hand, discardTop];

  let bestDw = Infinity;
  for (let i = 0; i < withDiscard.length; i++) {
    const remaining = withDiscard.filter((_, j) => j !== i);
    const dw = calculateDeadwood(remaining);
    if (dw < bestDw) bestDw = dw;
  }

  return bestDw < currentDw ? "discard" : "stock";
}

export function botChooseDiscard(hand: PlayingCard[]): number {
  let bestIdx = 0;
  let bestDw = Infinity;

  for (let i = 0; i < hand.length; i++) {
    const remaining = hand.filter((_, j) => j !== i);
    const dw = calculateDeadwood(remaining);
    if (dw < bestDw) {
      bestDw = dw;
      bestIdx = i;
    }
  }

  return bestIdx;
}

export function botShouldKnock(hand: PlayingCard[]): boolean {
  return calculateDeadwood(hand) <= KNOCK_THRESHOLD;
}
