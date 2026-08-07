import { CardName, Suit, type PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";
import {
  RANK_DISPLAY,
  SUIT_SYMBOL,
  cardOrder,
  createDeck,
  shuffle,
} from "../../shared/deck";
import type { MichiganConfig, MichiganMode } from "./config";

export type PlayerIndex = 0 | 1 | 2 | 3;

export type MichiganPhase =
  | "PRE_DEAL"
  | "DEALER_SWAP"
  | "AWAIT_LEAD"
  | "AWAIT_PLAY"
  | "AWAIT_FORCED"
  | "HAND_OVER"
  | "GAME_OVER";

export const PLAYER_LABELS = ["You", "Left", "Top", "Right"] as const;

export const SUITS: Suit[] = [
  Suit.Clubs,
  Suit.Diamonds,
  Suit.Hearts,
  Suit.Spades,
];

export interface BoodleSlot {
  cardName: CardName;
  suit: Suit;
  chips: number;
}

export const BOODLE_CARDS: ReadonlyArray<{ cardName: CardName; suit: Suit }> = [
  { cardName: CardName.Ace, suit: Suit.Hearts },
  { cardName: CardName.King, suit: Suit.Clubs },
  { cardName: CardName.Queen, suit: Suit.Diamonds },
  { cardName: CardName.Jack, suit: Suit.Spades },
];

export interface SequenceState {
  suit: Suit;
  /** Rank needed next: michRank (2–14) in Michigan, cardOrder (1–13) in Play or Pay. */
  nextOrder: number;
  lastPlayer: PlayerIndex;
  playedCount: number;
  cards: PlayingCard[];
}

export interface FanTanRow {
  low: number | null;
  high: number | null;
}

export interface MichiganState extends BaseGameState {
  phase: MichiganPhase;
  mode: MichiganMode;
  hands: PlayingCard[][];
  /** Per-player session chips (seat 0 is the human). */
  chips: number[];
  pot: number;
  boodle: BoodleSlot[];
  /** Michigan's face-down widow / dead hand. */
  deadHand: PlayingCard[];
  /** Every card played this hand (for stops, rows and conservation checks). */
  played: PlayingCard[];
  sequence: SequenceState | null;
  /** Michigan: suit of the last finished sequence — constrains the next lead. */
  prevSuit: Suit | null;
  /** Fan Tan layout, keyed by suit. */
  rows: Record<number, FanTanRow>;
  /** Play or Pay: suits whose sequence has been led. */
  startedSuits: Suit[];
  /** Whose action is awaited (in Michigan runs: the holder of the next card). */
  currentTurn: PlayerIndex;
  dealer: PlayerIndex;
  handNumber: number;
  handWinner: PlayerIndex | null;
  /** Human's net chips for the session, set at GAME_OVER. */
  sessionNet: number;
}

/** Shared context the mode modules operate on. */
export interface ModeCtx {
  state: MichiganState;
  cfg: MichiganConfig;
  rng: () => number;
  endHand(winner: PlayerIndex): void;
}

export const ACE_HIGH = 14;

/** Michigan rank: 2 low … King 13, Ace high (14). */
export function michRank(card: PlayingCard): number {
  return card.cardName === CardName.Ace ? ACE_HIGH : cardOrder(card);
}

export function isRedSuit(suit: Suit): boolean {
  return suit === Suit.Diamonds || suit === Suit.Hearts;
}

export function nextSeat(p: PlayerIndex): PlayerIndex {
  return ((p + 1) % 4) as PlayerIndex;
}

export function cardLabel(card: PlayingCard): string {
  return `${RANK_DISPLAY[card.cardName]}${SUIT_SYMBOL[card.suit]}`;
}

/** Display label for a cardOrder/michRank value (1 and 14 are both the Ace). */
export function orderLabel(order: number): string {
  const cardName =
    order === ACE_HIGH ? CardName.Ace : ((order - 1) as CardName);
  return RANK_DISPLAY[cardName]!;
}

const SUIT_SORT: Record<number, number> = {
  [Suit.Clubs]: 0,
  [Suit.Diamonds]: 1,
  [Suit.Hearts]: 2,
  [Suit.Spades]: 3,
};

export function sortHand(hand: PlayingCard[], aceHigh: boolean): void {
  const rank = aceHigh ? michRank : cardOrder;
  hand.sort(
    (a, b) => SUIT_SORT[a.suit]! - SUIT_SORT[b.suit]! || rank(a) - rank(b),
  );
}

export function emptyRows(): Record<number, FanTanRow> {
  const rows: Record<number, FanTanRow> = {};
  for (const s of SUITS) rows[s] = { low: null, high: null };
  return rows;
}

export function freshState(cfg: MichiganConfig): MichiganState {
  return {
    phase: "PRE_DEAL",
    mode: cfg.mode,
    message: "Press Deal to start the session.",
    winner: null,
    hands: [[], [], [], []],
    chips: [
      cfg.startingChips,
      cfg.startingChips,
      cfg.startingChips,
      cfg.startingChips,
    ],
    pot: 0,
    boodle: BOODLE_CARDS.map((b) => ({ ...b, chips: 0 })),
    deadHand: [],
    played: [],
    sequence: null,
    prevSuit: null,
    rows: emptyRows(),
    startedSuits: [],
    currentTurn: 0,
    dealer: 3,
    handNumber: 0,
    handWinner: null,
    sessionNet: 0,
  };
}

/** Deal 13 cards to each seat, eldest hand first (Fan Tan / Play or Pay). */
export function dealFourHands(ctx: ModeCtx, aceHigh: boolean): void {
  const { state } = ctx;
  const deck = shuffle(createDeck(), ctx.rng);
  const eldest = nextSeat(state.dealer);
  for (let i = 0; i < 4; i++) {
    const seat = ((eldest + i) % 4) as PlayerIndex;
    state.hands[seat] = deck.slice(i * 13, (i + 1) * 13);
    sortHand(state.hands[seat]!, aceHigh);
  }
  state.deadHand = [];
}
