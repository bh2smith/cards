import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";

export type GolfPhase = "PLAYING" | "GAME_OVER";

export interface GolfOptions {
  wrapRank: boolean;
}

export interface GolfState extends BaseGameState {
  phase: GolfPhase;
  tableau: PlayingCard[][];
  stock: PlayingCard[];
  waste: PlayingCard | null;
  won: boolean;
  options: GolfOptions;
}
