import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";

export type AceyPhase = "DEAL" | "CALL_ACE" | "BETTING" | "RESULT";

export type AceCall = "high" | "low";

export type AceyOutcome = "win" | "lose" | "post" | "push";

export interface AceyState extends BaseGameState {
  phase: AceyPhase;
  card1: PlayingCard | null;
  card2: PlayingCard | null;
  card3: PlayingCard | null;
  /** How a leading ace was called; null otherwise. */
  aceCall: AceCall | null;
  /** Bracket bounds once both cards are up (lo < hi). */
  lo: number | null;
  hi: number | null;
  bet: number;
  /** Chips actually lost on a post (bet doubled, capped by the balance). */
  lost: number;
  outcome: AceyOutcome | null;
  balance: number;
}
