import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";

export type RedDogPhase = "BETTING" | "RAISE" | "RESULT";

export type RedDogOutcome = "win" | "lose" | "push";

export interface RedDogState extends BaseGameState {
  phase: RedDogPhase;
  card1: PlayingCard | null;
  card2: PlayingCard | null;
  card3: PlayingCard | null;
  /** Total stake at risk (doubles on a raise). */
  bet: number;
  raised: boolean;
  /** Ranks strictly between the two up cards; null for pairs/consecutive. */
  spread: number | null;
  /** Payout ratio the pending third card would pay (11 for a pair). */
  payoutRatio: number | null;
  outcome: RedDogOutcome | null;
  balance: number;
}
