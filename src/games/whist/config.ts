import type { FamilyDef } from "../../shared/engine/variant";

export type WhistMode = "whist" | "knockout" | "oh-hell" | "norwegian";

export interface WhistConfig {
  mode: WhistMode;
  /** Game-winning threshold: 7 points (classic) or 50 (Norwegian). */
  targetScore?: number;
}

export const WHIST_FAMILY: FamilyDef<WhistConfig> = {
  base: { mode: "whist", targetScore: 7 },
  presets: {
    knockout: { name: "Knockout Whist", overrides: { mode: "knockout" } },
    "oh-hell": { name: "Oh Hell", overrides: { mode: "oh-hell" } },
    norwegian: {
      name: "Norwegian Whist",
      overrides: { mode: "norwegian", targetScore: 50 },
    },
  },
};

export const KNOCKOUT_FIRST_HAND_SIZE = 7;
export const OH_HELL_MAX_HANDS = 10;
