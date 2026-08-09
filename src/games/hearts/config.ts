import { CardName, type PlayingCard } from "typedeck";
import type { FamilyDef } from "../../shared/engine/variant";
import type { PassDirection } from "./types";

export interface HeartsConfig {
  /** Penalty per captured heart. 1 in base; pip value (2–10, J 11, Q 12, K 13, A 14) in Spot. */
  heartValue: (card: PlayingCard) => number;
  /** Penalty for capturing each high spade. Base: Q♠ 13 only. */
  spadePenalties: { queen: number; king: number; ace: number };
  /** Bonus (negative points) for capturing the J♦. 0 base; −10 in Omnibus. */
  jackDiamondsBonus: number;
  /** Whether hands start with a passing phase. false in No Pass. */
  passing: boolean;
  /**
   * When set, every hand passes this direction instead of rotating
   * left/right/across/hold (Black Maria: always 3 to the right).
   */
  fixedPassDirection: PassDirection | null;
  /** Game ends when someone reaches this; lowest score wins. */
  targetScore: number;
}

/** Heart pip value for Spot Hearts: 2–10 face value, J 11, Q 12, K 13, A 14. */
function heartPipValue(card: PlayingCard): number {
  return card.cardName === CardName.Ace ? 14 : card.cardName + 1;
}

export const HEARTS_FAMILY: FamilyDef<HeartsConfig> = {
  // Base = Black Lady: hearts 1 each, Q♠ 13, rotating pass, moon swings 26.
  base: {
    heartValue: () => 1,
    spadePenalties: { queen: 13, king: 0, ace: 0 },
    jackDiamondsBonus: 0,
    passing: true,
    fixedPassDirection: null,
    targetScore: 100,
  },
  presets: {
    // Hearts count pips (104 total), no Q♠ penalty, moon = all hearts.
    spot: {
      name: "Spot Hearts",
      overrides: {
        heartValue: heartPipValue,
        spadePenalties: { queen: 0, king: 0, ace: 0 },
        targetScore: 500,
      },
    },
    // Q♠ 13, K♠ 10, A♠ 7; always pass 3 to the right. The moon still only
    // requires all hearts + Q♠ — K♠/A♠ need not be captured (see scoreRound).
    "black-maria": {
      name: "Black Maria",
      overrides: {
        spadePenalties: { queen: 13, king: 10, ace: 7 },
        fixedPassDirection: "right",
      },
    },
    // Base rules plus J♦ = −10 to its captor. The moon stays others +26; a
    // shooter who also captured the J♦ keeps its −10 ("take-all" = −10 total).
    omnibus: {
      name: "Omnibus",
      overrides: { jackDiamondsBonus: -10 },
    },
    // Every hand plays as dealt.
    "no-pass": {
      name: "No Pass",
      overrides: { passing: false },
    },
  },
};
