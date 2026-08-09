import type { FamilyDef } from "../../shared/engine/variant";

export interface EuchreConfig {
  /** 4 = partnership (two teams of two), 3 = cutthroat individuals. */
  players: 4 | 3;
  targetScore: number;
  /** Round 2 passing to the dealer forces them to name trump. */
  stickTheDealer: boolean;
  /** Railroad: the joker joins the deck as the permanent highest trump. */
  joker: boolean;
}

export const EUCHRE_FAMILY: FamilyDef<EuchreConfig> = {
  base: {
    players: 4,
    targetScore: 10,
    stickTheDealer: true,
    joker: false,
  },
  presets: {
    "no-stick": {
      name: "Gentleman's",
      overrides: { stickTheDealer: false },
    },
    cutthroat: {
      name: "Three-Hand",
      overrides: { players: 3 },
    },
    railroad: {
      name: "Railroad",
      overrides: { joker: true },
    },
  },
};
