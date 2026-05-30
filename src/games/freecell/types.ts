import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";

export type FreecellPhase = "PLAYING" | "GAME_OVER";

export type FreecellSelection =
  | { type: "free"; cell: number }
  | { type: "tableau"; col: number; cardIndex: number }
  | null;

export interface FreecellState extends BaseGameState {
  phase: FreecellPhase;
  tableau: PlayingCard[][]; // 8 columns, all face-up
  freeCells: (PlayingCard | null)[]; // 4 single-card cells
  foundations: PlayingCard[][]; // 4 piles, one per suit, Ace → King
  selected: FreecellSelection;
  won: boolean;
  moves: number;
  dealNumber: number;
}

export const FREE_CELLS = 4;
