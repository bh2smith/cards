import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";

export type KlondikePhase = "PLAYING" | "GAME_OVER";

export interface TableauColumn {
  faceDown: PlayingCard[];
  faceUp: PlayingCard[];
}

export type KlondikeSelection =
  | { type: "waste" }
  | { type: "tableau"; col: number; cardIndex: number }
  | null;

export interface KlondikeState extends BaseGameState {
  phase: KlondikePhase;
  tableau: TableauColumn[];
  foundations: PlayingCard[][]; // 4 piles, one per suit
  stock: PlayingCard[];
  waste: PlayingCard[];
  selected: KlondikeSelection;
  won: boolean;
  moves: number;
}
