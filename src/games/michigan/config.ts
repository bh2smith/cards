import type { FamilyDef } from "../../shared/engine/variant";

export type MichiganMode = "michigan" | "fan-tan" | "play-or-pay";

export interface MichiganConfig {
  mode: MichiganMode;
  /** Chips each player antes onto every boodle card (the dealer pays double). */
  boodleAnte: number;
  /** Chips each player antes into the pot per hand (Fan Tan / Play or Pay). */
  potAnte: number;
  /** Hands per session before chips settle into the bankroll. */
  handsPerGame: number;
  /** Session chip stack every player starts with. */
  startingChips: number;
}

export const MICHIGAN_FAMILY: FamilyDef<MichiganConfig> = {
  base: {
    mode: "michigan",
    boodleAnte: 1,
    potAnte: 1,
    handsPerGame: 4,
    startingChips: 50,
  },
  presets: {
    "fan-tan": { name: "Fan Tan", overrides: { mode: "fan-tan" } },
    "play-or-pay": { name: "Play or Pay", overrides: { mode: "play-or-pay" } },
  },
};
