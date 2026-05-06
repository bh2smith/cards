import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";

export type PyramidPhase = "PLAYING" | "GAME_OVER";

export type PyramidCard = PlayingCard | null;

export type PyramidSelection = [number, number] | "waste" | null;

export interface PyramidState extends BaseGameState {
  phase: PyramidPhase;
  pyramid: PyramidCard[][];
  stock: PlayingCard[];
  waste: PlayingCard[];
  selected: PyramidSelection;
  won: boolean;
}
