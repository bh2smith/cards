import type { PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";

export type OldMaidPhase = "PLAYER_DRAW" | "BOT_DRAW" | "GAME_OVER";

export interface OldMaidState extends BaseGameState {
  phase: OldMaidPhase;
  /** Player's cards, face-up, kept sorted by rank. */
  playerHand: PlayingCard[];
  /** The bot's hand is hidden — the UI only sees how many face-down cards to fan. */
  botHandCount: number;
  /** Fanned positions the player may draw from on their turn. */
  botDrawableIndices: number[];
  playerPairs: number;
  botPairs: number;
  /** The lone surviving card once the game ends — always the odd Queen. */
  oddCard: PlayingCard | null;
}
