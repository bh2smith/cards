import { CardName, Suit, type PlayingCard } from "typedeck";
import type { BaseGameState } from "../../shared/types";
import { RANK_DISPLAY, SUIT_SYMBOL, cardOrder } from "../../shared/deck";
import type { TrickPlay, TrickRules } from "../../shared/engine/trick";
import type { WhistConfig, WhistMode } from "./config";

// Seats are clockwise: 0 = You (bottom), 1 = Left, 2 = Top, 3 = Right.
// Partnership modes (whist, norwegian): team 0 = {0, 2}, team 1 = {1, 3}.
export type PlayerIndex = 0 | 1 | 2 | 3;
export type Team = 0 | 1;

export type WhistPhase =
  | "PRE_DEAL"
  | "DECLARING" // norwegian: grand / nullo / pass
  | "BIDDING" // oh-hell: exact-trick bids
  | "TRUMP_PICK" // knockout: last hand's trick leader names trump
  | "PLAYING"
  | "HAND_OVER"
  | "GAME_OVER";

export type HandType = "grand" | "nullo";

export const PLAYER_LABELS = ["You", "Left", "Top", "Right"] as const;

export const SUITS: Suit[] = [
  Suit.Spades,
  Suit.Hearts,
  Suit.Clubs,
  Suit.Diamonds,
];

export interface Trick {
  leader: PlayerIndex;
  plays: TrickPlay<PlayerIndex>[];
  winner: PlayerIndex | null;
}

export interface WhistState extends BaseGameState {
  phase: WhistPhase;
  mode: WhistMode;
  hands: PlayingCard[][];
  /** Undealt remainder of the deck (knockout / oh-hell short deals). */
  stock: PlayingCard[];
  dealer: PlayerIndex;
  /** First active seat left of the dealer, fixed at each deal. */
  eldest: PlayerIndex;
  handNumber: number;
  /** Cards dealt to each active player this hand (= tricks to play). */
  handSize: number;
  trump: Suit | null;
  /** The physical turned card, when there is one to show. */
  trumpCard: PlayingCard | null;
  /** Classic whist: the turned card is the dealer's own last card (in hand). */
  trumpCardInHand: boolean;
  currentTurn: PlayerIndex;
  currentTrick: Trick | null;
  completedTricks: Trick[];
  /** Tricks taken this hand, per seat. */
  trickCounts: number[];
  /** Whist / Norwegian game points per team. */
  teamScores: [number, number];
  /** Oh Hell cumulative points per seat. */
  scores: number[];
  /** Oh Hell bids per seat (null until placed). */
  bids: (number | null)[];
  /** Knockout: seats out of the game. */
  eliminated: boolean[];
  /** Knockout: who names trump for the current/next hand. */
  trumpChooser: PlayerIndex | null;
  /** Norwegian hand type once fixed. */
  handType: HandType | null;
  /** Norwegian: the seat whose declaration fixed the hand type. */
  declarer: PlayerIndex | null;
  /** Winner of the most recent completed trick (knockout tie-out). */
  lastTrickWinner: PlayerIndex | null;
}

/** Shared context the mode modules operate on. */
export interface ModeCtx {
  state: WhistState;
  cfg: WhistConfig;
  rng: () => number;
}

export const ACE_HIGH = 14;

/** Ace-high rank on top of cardOrder: 2..10, J=11, Q=12, K=13, A=14. */
export function aceHighRank(card: PlayingCard): number {
  return card.cardName === CardName.Ace ? ACE_HIGH : cardOrder(card);
}

/** No-bower trick rules: trump (if any) over led suit, ace high. */
export function whistRules(trump: Suit | null): TrickRules {
  return {
    effectiveSuit: (card) => card.suit,
    strength: (card, ledSuit) => {
      if (trump !== null && card.suit === trump) return 200 + aceHighRank(card);
      if (card.suit === ledSuit) return 100 + aceHighRank(card);
      return 0;
    },
  };
}

export function teamOf(seat: PlayerIndex): Team {
  return (seat % 2) as Team;
}

export function partnerOf(seat: PlayerIndex): PlayerIndex {
  return ((seat + 2) % 4) as PlayerIndex;
}

export function nextSeat(seat: PlayerIndex): PlayerIndex {
  return ((seat + 1) % 4) as PlayerIndex;
}

/** Next non-eliminated seat after `seat`. */
export function nextActiveSeat(
  state: WhistState,
  seat: PlayerIndex,
): PlayerIndex {
  let n = nextSeat(seat);
  while (state.eliminated[n]) n = nextSeat(n);
  return n;
}

export function activeSeats(state: WhistState): PlayerIndex[] {
  return ([0, 1, 2, 3] as PlayerIndex[]).filter((s) => !state.eliminated[s]);
}

/** Active seats in rotation order starting at eldest (dealer last). */
export function seatOrderFromEldest(state: WhistState): PlayerIndex[] {
  const order: PlayerIndex[] = [];
  let seat = state.eldest;
  for (let i = 0; i < 4; i++) {
    if (!state.eliminated[seat]) order.push(seat);
    seat = nextSeat(seat);
  }
  return order;
}

export function suitName(suit: Suit): string {
  switch (suit) {
    case Suit.Hearts:
      return "Hearts";
    case Suit.Diamonds:
      return "Diamonds";
    case Suit.Clubs:
      return "Clubs";
    default:
      return "Spades";
  }
}

export function cardLabel(card: PlayingCard): string {
  return `${RANK_DISPLAY[card.cardName]}${SUIT_SYMBOL[card.suit]}`;
}

const SUIT_SORT: Record<number, number> = {
  [Suit.Spades]: 0,
  [Suit.Hearts]: 1,
  [Suit.Clubs]: 2,
  [Suit.Diamonds]: 3,
};

/** Sort for display: trump suit first (if any), then suits, rank descending. */
export function sortWhistHand(hand: PlayingCard[], trump: Suit | null): void {
  const group = (c: PlayingCard): number =>
    trump !== null && c.suit === trump ? -1 : SUIT_SORT[c.suit]!;
  hand.sort((a, b) => group(a) - group(b) || aceHighRank(b) - aceHighRank(a));
}

export function startPlaying(state: WhistState, leader: PlayerIndex): void {
  state.phase = "PLAYING";
  state.currentTrick = { leader, plays: [], winner: null };
  state.currentTurn = leader;
}

/** Per-hand fields cleared before each mode's deal. */
export function resetHandState(state: WhistState): void {
  state.hands = [[], [], [], []];
  state.stock = [];
  state.handSize = 0;
  state.trump = null;
  state.trumpCard = null;
  state.trumpCardInHand = false;
  state.currentTrick = null;
  state.completedTricks = [];
  state.trickCounts = [0, 0, 0, 0];
  state.bids = [null, null, null, null];
  state.handType = null;
  state.declarer = null;
}

export function freshState(cfg: WhistConfig): WhistState {
  return {
    phase: "PRE_DEAL",
    mode: cfg.mode,
    message: "Press Deal to start.",
    winner: null,
    hands: [[], [], [], []],
    stock: [],
    dealer: 3, // so You (0) are eldest hand on the first deal
    eldest: 0,
    handNumber: 0,
    handSize: 0,
    trump: null,
    trumpCard: null,
    trumpCardInHand: false,
    currentTurn: 0,
    currentTrick: null,
    completedTricks: [],
    trickCounts: [0, 0, 0, 0],
    teamScores: [0, 0],
    scores: [0, 0, 0, 0],
    bids: [null, null, null, null],
    eliminated: [false, false, false, false],
    trumpChooser: null,
    handType: null,
    declarer: null,
    lastTrickWinner: null,
  };
}
