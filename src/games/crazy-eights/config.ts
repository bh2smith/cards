import { CardName } from "typedeck";
import type { FamilyDef } from "../../shared/engine/variant";

export interface CrazyEightsConfig {
  handSize: number;
  targetScore: number;
  wildRank: CardName;
  /** Penalty value of a wild card left in hand. */
  wildValue: number;
  /** Max draws per turn when stuck; null = draw until playable. */
  maxDrawsPerTurn: number | null;
}

export const CRAZY_EIGHTS_FAMILY: FamilyDef<CrazyEightsConfig> = {
  base: {
    handSize: 7,
    targetScore: 100,
    wildRank: CardName.Eight,
    wildValue: 50,
    maxDrawsPerTurn: null,
  },
  presets: {
    "crazy-jacks": {
      name: "Crazy Jacks",
      overrides: { wildRank: CardName.Jack },
    },
    "draw-one": {
      name: "Draw One",
      overrides: { maxDrawsPerTurn: 1 },
    },
  },
};

export const WILD_LABEL: Partial<Record<CardName, string>> = {
  [CardName.Eight]: "an eight",
  [CardName.Jack]: "a Jack",
};
