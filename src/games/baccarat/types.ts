import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";
import type { BaccaratMode } from "./config";

export type BaccaratPhase =
  | "BETTING"
  | "PUNTER_DECISION"
  | "BANKER_DECISION"
  | "COUP_OVER";

export type BetKind = "player" | "banker" | "tie";

export interface BaccaratBet {
  on: BetKind;
  amount: number;
}

export type CoupOutcome = "player" | "banker" | "tie";

export interface CoupResult {
  outcome: CoupOutcome;
  natural: boolean;
  playerTotal: number;
  bankerTotal: number;
}

/** Chemin de Fer table: seat 0 is the human; seats 1 and 2 are bots. */
export const SEAT_NAMES = ["You", "Vera", "Otto"] as const;

export interface BaccaratState extends BaseGameState {
  phase: BaccaratPhase;
  mode: BaccaratMode;
  /** Cards left in the shoe. */
  shoeCount: number;
  playerCards: PlayingCard[];
  bankerCards: PlayingCard[];
  /** Punto banco side bets riding on the current coup. */
  bets: BaccaratBet[];
  result: CoupResult | null;
  /** Net bankroll change for the human on the last settled coup. */
  lastNet: number;
  /** Chemin de Fer: session purses for the bot seats (1 and 2). */
  botPurses: [number, number];
  bankerSeat: number;
  punterSeat: number;
  bankStake: number;
  /** Amount actually at risk this coup (punter cover, capped at funds). */
  coupAmount: number;
  /** Consecutive coups the current banker has held the bank. */
  bankerCoups: number;
  /** The bank rotates at the next coup (banker lost or chose to pass). */
  bankWillPass: boolean;
}
