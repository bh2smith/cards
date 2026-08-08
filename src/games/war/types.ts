import type { PlayingCard } from "typedeck";
import type { BaseGameState, Player } from "../../shared/types";

export type WarPhase = "READY" | "BATTLE" | "WAR" | "GAME_OVER";

export interface WarSetup {
  /** Deterministic shuffle seed. Ignored when a pre-arranged deck is given. */
  seed?: number;
  /** Pre-arranged deck for tests; each pile's top card comes first. */
  deck?: PlayingCard[];
  /** Deck index where the computer's pile starts (default: half the deck). */
  split?: number;
}

export interface WarState extends BaseGameState {
  phase: WarPhase;
  playerPile: PlayingCard[];
  computerPile: PlayingCard[];
  playerBattle: PlayingCard | null;
  computerBattle: PlayingCard | null;
  /** Spoils at stake beyond the current battle cards, in capture order. */
  table: PlayingCard[];
  playerBuried: number;
  computerBuried: number;
  battleCount: number;
  /** Winner of the last resolved battle; spoils are collected on the next flip. */
  battleWinner: Player | null;
}
