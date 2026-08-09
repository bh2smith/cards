import { CardName, type PlayingCard } from "typedeck";
import type { FamilyDef } from "../../shared/engine/variant";
import type { RunOptions } from "../../shared/engine/melds";
import { pipValue } from "./types";

export interface GinConfig {
  /**
   * Max deadwood to knock. Oklahoma derives it from the round's initial
   * upcard (ace → 0, gin-only round).
   */
  knockThreshold: number | ((upcard: PlayingCard) => number);
  ginBonus: number;
  undercutBonus: number;
  targetScore: number;
  /** A-2-3, Q-K-A and wrapping K-A-2 runs; ace deadwood value stays 1. */
  roundTheCorner: boolean;
  /** Oklahoma: a spade initial upcard doubles the hand's score. */
  spadeUpcardDoubles: boolean;
  /** Hollywood: rounds score into three simultaneous game columns. */
  hollywood: boolean;
}

export const GIN_FAMILY: FamilyDef<GinConfig> = {
  base: {
    knockThreshold: 10,
    ginBonus: 25,
    undercutBonus: 25,
    targetScore: 100,
    roundTheCorner: false,
    spadeUpcardDoubles: false,
    hollywood: false,
  },
  presets: {
    oklahoma: {
      name: "Oklahoma",
      overrides: {
        knockThreshold: (upcard: PlayingCard) =>
          upcard.cardName === CardName.Ace ? 0 : pipValue(upcard),
        spadeUpcardDoubles: true,
      },
    },
    "round-the-corner": {
      name: "Round the Corner",
      overrides: { roundTheCorner: true },
    },
    hollywood: {
      name: "Hollywood",
      overrides: { hollywood: true },
    },
  },
};

/** The knock cap for a round, given its initial upcard. */
export function resolveKnockThreshold(
  config: GinConfig,
  upcard: PlayingCard,
): number {
  return typeof config.knockThreshold === "function"
    ? config.knockThreshold(upcard)
    : config.knockThreshold;
}

/** Run options for the shared meld engine under this config. */
export function ginRunOptions(config: GinConfig): RunOptions {
  return {
    minLength: 3,
    aceHigh: config.roundTheCorner,
    roundTheCorner: config.roundTheCorner,
  };
}
