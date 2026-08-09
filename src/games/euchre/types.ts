import { type PlayingCard, CardName, Suit } from "typedeck";

// Seats are clockwise: 0 = You (bottom), 1 = Left, 2 = Partner (top), 3 = Right.
// Partnerships: team 0 = {0, 2} (You + Partner), team 1 = {1, 3} (Left + Right).
export type PlayerIndex = 0 | 1 | 2 | 3;
export type Team = 0 | 1;

export type EuchrePhase =
  | "BID1" // round 1: order up the turned card, or pass
  | "BID2" // round 2: name a suit (not the turned-down suit), or pass
  | "DISCARD" // human dealer discards after picking up the up-card
  | "ALONE_DISCARD" // railroad: human loner discards after the partner's gift
  | "PLAYING"
  | "HAND_OVER"
  | "GAME_OVER";

export interface TrickPlay {
  player: PlayerIndex;
  card: PlayingCard;
}

export interface Trick {
  leader: PlayerIndex;
  plays: TrickPlay[];
  winner: PlayerIndex | null;
}

/**
 * A "side" is a scoring unit: a team (0/1) in partnership play, an individual
 * player (0–2) in cutthroat. `awards` lists every side that scores this hand
 * (cutthroat euchre pays each defender); `scoringTeam`/`points` mirror the
 * first award for the common single-scorer case.
 */
export interface HandResult {
  makerTeam: number;
  maker: PlayerIndex;
  alone: boolean;
  trickWins: number[];
  scoringTeam: number;
  points: number;
  awards: { side: number; points: number }[];
  kind: "made" | "march" | "alone-march" | "euchre";
}

export interface EuchreState {
  phase: EuchrePhase;
  message: string;
  hands: PlayingCard[][]; // 4 hands
  dealer: PlayerIndex;
  upCard: PlayingCard | null; // the turned-up card (null once picked up)
  turnedDownSuit: Suit | null; // set when round 1 passes out
  kitty: PlayingCard[]; // the 3 buried cards (hidden)
  trump: Suit | null;
  maker: PlayerIndex | null;
  alone: boolean;
  aloneSitter: PlayerIndex | null; // partner sitting out a loner hand
  bidTurn: PlayerIndex; // whose turn to bid
  currentTurn: PlayerIndex; // whose turn to play
  currentTrick: Trick | null;
  completedTricks: Trick[];
  trickWins: SideScores; // tricks won this hand, per side
  scores: SideScores; // game points, per side
  handResult: HandResult | null;
  winner: number | null; // winning side
}

/** Per-side tallies: two teams in partnership play, three players cutthroat. */
export type SideScores = [number, number] | [number, number, number];

export const GAME_POINTS = 10;
export const HAND_SIZE = 5;
export const EUCHRE_RANKS = new Set<CardName>([
  CardName.Nine,
  CardName.Ten,
  CardName.Jack,
  CardName.Queen,
  CardName.King,
  CardName.Ace,
]);

export function teamOf(player: PlayerIndex): Team {
  return (player % 2) as Team;
}

export function partnerOf(player: PlayerIndex): PlayerIndex {
  return ((player + 2) % 4) as PlayerIndex;
}

export function nextPlayer(player: PlayerIndex): PlayerIndex {
  return ((player + 1) % 4) as PlayerIndex;
}

/** Next player to act, skipping a loner's sitting-out partner. */
export function nextActive(
  player: PlayerIndex,
  sitter: PlayerIndex | null,
): PlayerIndex {
  let n = nextPlayer(player);
  if (n === sitter) n = nextPlayer(n);
  return n;
}

/** The other suit of the same color (Hearts↔Diamonds, Clubs↔Spades). */
export function sameColorSuit(suit: Suit): Suit {
  switch (suit) {
    case Suit.Hearts:
      return Suit.Diamonds;
    case Suit.Diamonds:
      return Suit.Hearts;
    case Suit.Clubs:
      return Suit.Spades;
    default:
      return Suit.Clubs; // Spades
  }
}

export function isRightBower(card: PlayingCard, trump: Suit): boolean {
  return card.cardName === CardName.Jack && card.suit === trump;
}

export function isLeftBower(card: PlayingCard, trump: Suit): boolean {
  return card.cardName === CardName.Jack && card.suit === sameColorSuit(trump);
}

/** Railroad joker — only ever in the deck when the variant enables it. */
export function isJoker(card: PlayingCard): boolean {
  return card.cardName === CardName.Joker;
}

/**
 * The suit a card plays as: the joker and the left bower play as trump,
 * everything else as printed.
 */
export function effectiveSuit(card: PlayingCard, trump: Suit): Suit {
  return isJoker(card) || isLeftBower(card, trump) ? trump : card.suit;
}

export function isTrump(card: PlayingCard, trump: Suit): boolean {
  return effectiveSuit(card, trump) === trump;
}

// Non-trump ordering: A > K > Q > J > 10 > 9.
function faceRank(cardName: CardName): number {
  switch (cardName) {
    case CardName.Ace:
      return 5;
    case CardName.King:
      return 4;
    case CardName.Queen:
      return 3;
    case CardName.Jack:
      return 2;
    case CardName.Ten:
      return 1;
    default:
      return 0; // Nine
  }
}

// Trump ordering: joker (railroad) > right bower > left bower > A > K > Q > 10 > 9.
function trumpRank(card: PlayingCard, trump: Suit): number {
  if (isJoker(card)) return 7;
  if (isRightBower(card, trump)) return 6;
  if (isLeftBower(card, trump)) return 5;
  switch (card.cardName) {
    case CardName.Ace:
      return 4;
    case CardName.King:
      return 3;
    case CardName.Queen:
      return 2;
    case CardName.Ten:
      return 1;
    default:
      return 0; // Nine
  }
}

/**
 * Comparable strength of a card within a trick. Trump beats the led suit, which
 * beats everything else (which can't win). `ledSuit` is the *effective* suit of
 * the card that led the trick.
 */
export function cardStrength(
  card: PlayingCard,
  trump: Suit,
  ledSuit: Suit,
): number {
  if (isTrump(card, trump)) return 200 + trumpRank(card, trump);
  if (effectiveSuit(card, trump) === ledSuit)
    return 100 + faceRank(card.cardName);
  return 0;
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
