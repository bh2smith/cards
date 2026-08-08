import type { PlayingCard } from "typedeck";
import type { BaseGameState, Player } from "../../shared/types";
import type { Meld } from "../../shared/engine/melds";
import { cardOrder } from "../../shared/deck";

export type RummyPhase =
  | "PLAYER_TURN"
  | "PLAYER_MELD"
  | "BOT_TURN"
  | "ROUND_OVER"
  | "GAME_OVER";

/** A face-up meld on the table, tagged with the seat that laid it. */
export interface TableMeld {
  owner: Player;
  type: "set" | "run";
  cards: PlayingCard[];
}

export interface KnockResult {
  knocker: Player;
  knockerMelds: Meld[];
  knockerDeadwoodValue: number;
  defenderMelds: Meld[];
  defenderDeadwoodValue: number;
  isUndercut: boolean;
  roundPoints: number;
  pointsTo: Player;
}

export interface RummyState extends BaseGameState {
  phase: RummyPhase;
  playerScore: number;
  computerScore: number;
  dealer: Player;
  currentTurn: Player;
  playerHand: PlayingCard[];
  computerHand: PlayingCard[];
  stock: PlayingCard[];
  discardPile: PlayingCard[];
  tableMelds: TableMeld[];
  /** points-500: running credit for cards each seat has laid this hand. */
  meldPoints: Record<Player, number>;
  /** Cards each seat has taken from the discard pile (bot danger signal). */
  pickups: Record<Player, PlayingCard[]>;
  /** 500 Rum: buried discard just taken that must be melded before discarding. */
  mustMeld: PlayingCard | null;
  /** Times the stock was rebuilt from the discard this hand (max one). */
  reshuffles: number;
  roundWinner: Player | null;
  roundPoints: number;
  /** Score deltas of the round just settled (bookkeeping/tests). */
  roundDeltas: Record<Player, number> | null;
  knockResult: KnockResult | null;
  winner: Player | null;
}

export function sortHand(hand: PlayingCard[]): void {
  hand.sort((a, b) => cardOrder(a) - cardOrder(b) || a.suit - b.suit);
}

export function otherPlayer(seat: Player): Player {
  return seat === "player" ? "computer" : "player";
}
