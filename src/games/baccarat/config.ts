import type { FamilyDef } from "../../shared/engine/variant";

export type BaccaratMode = "punto-banco" | "chemin-de-fer";

export interface BaccaratConfig {
  mode: BaccaratMode;
  /** Decks in the shoe. */
  decks: number;
  /** Rebuild the shoe when fewer cards than this remain. */
  reshuffleBelow: number;
  /** Session purse each bot seat starts with (Chemin de Fer). */
  botPurse: number;
  /** Coups a winning bot banker keeps the bank before passing. */
  botGardeMax: number;
}

export const BACCARAT_FAMILY: FamilyDef<BaccaratConfig> = {
  base: {
    mode: "punto-banco",
    decks: 6,
    reshuffleBelow: 20,
    botPurse: 100,
    botGardeMax: 3,
  },
  presets: {
    "chemin-de-fer": {
      name: "Chemin de Fer",
      overrides: { mode: "chemin-de-fer" },
    },
  },
};
