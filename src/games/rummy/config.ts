import type { FamilyDef } from "../../shared/engine/variant";

export interface RummyConfig {
  handSize: number;
  /** Lay melds face-up during play (true) vs hold everything like gin (false). */
  meldsOnTable: boolean;
  /** Extend anyone's table melds with single cards. */
  layOffAllowed: boolean;
  /** Knock Rummy: go out by knocking; Infinity threshold = any deadwood. */
  knock: { threshold: number } | null;
  runOptions: { aceHigh: boolean; roundTheCorner: boolean };
  scoring: "shed" | "deadwood-diff" | "points-500";
  targetScore: number;
  /** 500 Rum: "any" allows taking a buried discard (plus every card above it). */
  discardPickup: "top" | "any";
  /** Boathouse: taking the discard forces a second draw from stock (2 in, 1 out). */
  boathouseDoubleDraw: boolean;
  /** Boathouse: go out only by melding the entire hand at once ("rummy"). */
  mustGoRummy: boolean;
  /** Oklahoma: the Q♠ counts 50 wherever it scores. */
  spadeQueenBonus: boolean;
}

const RUM_500_OVERRIDES: Partial<RummyConfig> = {
  scoring: "points-500",
  targetScore: 500,
  discardPickup: "any",
  runOptions: { aceHigh: true, roundTheCorner: false },
};

export const RUMMY_FAMILY: FamilyDef<RummyConfig> = {
  base: {
    handSize: 10,
    meldsOnTable: true,
    layOffAllowed: true,
    knock: null,
    runOptions: { aceHigh: false, roundTheCorner: false },
    scoring: "shed",
    targetScore: 100,
    discardPickup: "top",
    boathouseDoubleDraw: false,
    mustGoRummy: false,
    spadeQueenBonus: false,
  },
  presets: {
    "knock-rummy": {
      name: "Knock Rummy",
      overrides: {
        meldsOnTable: false,
        layOffAllowed: false,
        knock: { threshold: Infinity },
        scoring: "deadwood-diff",
      },
    },
    "500-rum": {
      name: "500 Rum",
      overrides: RUM_500_OVERRIDES,
    },
    boathouse: {
      name: "Boathouse Rum",
      overrides: {
        meldsOnTable: false,
        layOffAllowed: false,
        runOptions: { aceHigh: false, roundTheCorner: true },
        boathouseDoubleDraw: true,
        mustGoRummy: true,
      },
    },
    "oklahoma-rum": {
      name: "Oklahoma Rum",
      overrides: { ...RUM_500_OVERRIDES, spadeQueenBonus: true },
    },
  },
};
