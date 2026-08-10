import type { FamilyDef } from "../../shared/engine/variant";

export interface BlackjackConfig {
  /** Decks in the shoe. 1 reshuffles every round; more persist across rounds. */
  decks: number;
  /** H17 (true, base) vs S17: does the dealer hit a soft 17? */
  dealerHitsSoft17: boolean;
  /** Two-card totals eligible for doubling down. */
  doubleOn: "any" | "8-11" | "9-11" | "10-11";
  /** Late surrender: first two cards only, after the dealer checks for blackjack. */
  surrender: boolean;
  /** Natural blackjack pays 3:2 in every variant. */
  blackjackPays: 1.5;
  /** Re-splitting split hands. False everywhere: the two-hand model caps at one split. */
  resplit: boolean;
}

export const BLACKJACK_FAMILY: FamilyDef<BlackjackConfig> = {
  // Base = current house rules: single deck, dealer hits soft 17,
  // double on 8-11, one split max, no surrender.
  base: {
    decks: 1,
    dealerHitsSoft17: true,
    doubleOn: "8-11",
    surrender: false,
    blackjackPays: 1.5,
    resplit: false,
  },
  presets: {
    s17: {
      name: "Dealer Stands S17",
      overrides: { dealerHitsSoft17: false },
    },
    "six-deck": {
      name: "Six-Deck Shoe",
      overrides: { decks: 6 },
    },
    surrender: {
      name: "Late Surrender",
      overrides: { surrender: true },
    },
    "tight-double": {
      name: "Tight Double",
      overrides: { doubleOn: "10-11" },
    },
  },
};

const DOUBLE_RANGES: Record<
  Exclude<BlackjackConfig["doubleOn"], "any">,
  readonly [number, number]
> = {
  "8-11": [8, 11],
  "9-11": [9, 11],
  "10-11": [10, 11],
};

/** Whether a two-card hand of this value may double under the config. */
export function doubleAllowed(
  doubleOn: BlackjackConfig["doubleOn"],
  value: number,
): boolean {
  if (doubleOn === "any") return true;
  const [lo, hi] = DOUBLE_RANGES[doubleOn];
  return value >= lo && value <= hi;
}
