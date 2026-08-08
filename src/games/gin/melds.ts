import type { PlayingCard } from "typedeck";
import { pipValue, KNOCK_THRESHOLD, type Meld } from "./types";
import {
  findAllSets as coreFindAllSets,
  findAllRuns as coreFindAllRuns,
  findBestMelds as coreFindBestMelds,
  deadwoodValue as coreDeadwoodValue,
  findLayoffs as coreFindLayoffs,
  type RunOptions,
} from "../../shared/engine/melds";

// Default gin runs: ace-low, minimum three cards.
const GIN_RUNS: RunOptions = {
  minLength: 3,
  aceHigh: false,
  roundTheCorner: false,
};

export function findAllSets(hand: PlayingCard[]): Meld[] {
  return coreFindAllSets(hand);
}

export function findAllRuns(
  hand: PlayingCard[],
  options: RunOptions = GIN_RUNS,
): Meld[] {
  return coreFindAllRuns(hand, options);
}

export function findBestMelds(
  hand: PlayingCard[],
  options: RunOptions = GIN_RUNS,
): {
  melds: Meld[];
  deadwood: PlayingCard[];
} {
  return coreFindBestMelds(hand, pipValue, options);
}

export function deadwoodValue(cards: PlayingCard[]): number {
  return coreDeadwoodValue(cards, pipValue);
}

export function calculateDeadwood(
  hand: PlayingCard[],
  options: RunOptions = GIN_RUNS,
): number {
  return deadwoodValue(findBestMelds(hand, options).deadwood);
}

export function canKnock(
  hand: PlayingCard[],
  threshold: number = KNOCK_THRESHOLD,
  options: RunOptions = GIN_RUNS,
): boolean {
  return calculateDeadwood(hand, options) <= threshold;
}

export function isGin(
  hand: PlayingCard[],
  options: RunOptions = GIN_RUNS,
): boolean {
  return calculateDeadwood(hand, options) === 0;
}

export function findLayoffs(
  defenderDeadwood: PlayingCard[],
  knockerMelds: Meld[],
  options: RunOptions = GIN_RUNS,
): PlayingCard[] {
  return coreFindLayoffs(defenderDeadwood, knockerMelds, options);
}
