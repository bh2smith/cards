import { CardName, Suit, type PlayingCard } from "typedeck";
import type { BaseGameState, Player } from "../../shared/types";
import { cardKey } from "../../shared/deck";

/** Maximum cards a hand may hold; drawing past this is illegal. */
export const HAND_LIMIT = 8;

/**
 * Points needed to win, indexed by the number of Kings you control.
 * 0 Kings → 21, 1 → 14, 2 → 10, 3 → 5, 4 → 0 (four kings wins outright).
 */
export const WIN_THRESHOLDS = [21, 14, 10, 5, 0] as const;

export function winThreshold(kings: number): number {
  return WIN_THRESHOLDS[Math.min(kings, 4)]!;
}

/** Suit strength for scuttle tie-breaks: Clubs < Diamonds < Hearts < Spades. */
const SUIT_STRENGTH: Record<number, number> = {
  [Suit.Clubs]: 0,
  [Suit.Diamonds]: 1,
  [Suit.Hearts]: 2,
  [Suit.Spades]: 3,
};

export function suitStrength(card: PlayingCard): number {
  return SUIT_STRENGTH[card.suit]!;
}

/** Point value of a number card (Ace = 1 … Ten = 10). Faces are never points. */
export function pointValue(card: PlayingCard): number {
  return card.cardName + 1;
}

/** Number cards are Ace (0) through Ten (9); these can be points or scuttle. */
export function isNumberCard(card: PlayingCard): boolean {
  return card.cardName <= CardName.Ten;
}

/** Cards with a one-off effect: A, 2, 3, 4, 5, 6, 7, and 9 (not 8 or 10). */
export function hasOneOff(card: PlayingCard): boolean {
  const r = card.cardName;
  return (r >= CardName.Ace && r <= CardName.Seven) || r === CardName.Nine;
}

export const isKing = (c: PlayingCard) => c.cardName === CardName.King;
export const isQueen = (c: PlayingCard) => c.cardName === CardName.Queen;
export const isJack = (c: PlayingCard) => c.cardName === CardName.Jack;
export const isEight = (c: PlayingCard) => c.cardName === CardName.Eight;
export const isTwo = (c: PlayingCard) => c.cardName === CardName.Two;

/**
 * Can `attacker` scuttle `target`? A higher point value wins; equal values are
 * broken by suit strength (Clubs < Diamonds < Hearts < Spades).
 */
export function canScuttle(
  attacker: PlayingCard,
  target: PlayingCard,
): boolean {
  const av = pointValue(attacker);
  const tv = pointValue(target);
  if (av > tv) return true;
  if (av === tv) return suitStrength(attacker) > suitStrength(target);
  return false;
}

/** A card on the field together with its original owner and any attached jacks. */
export interface FieldCard {
  card: PlayingCard;
  /** The player who first played this card (jacks can move control elsewhere). */
  owner: Player;
  /** Jacks stacked on a point card; empty for royals and glasses. */
  jacks: PlayingCard[];
}

export interface Field {
  points: FieldCard[];
  queens: FieldCard[];
  kings: FieldCard[];
  glasses: FieldCard[];
}

export function emptyField(): Field {
  return { points: [], queens: [], kings: [], glasses: [] };
}

export function pointTotal(field: Field): number {
  return field.points.reduce((sum, fc) => sum + pointValue(fc.card), 0);
}

/** All field cards in one list (useful for targeting / cleanup). */
export function allFieldCards(field: Field): FieldCard[] {
  return [...field.points, ...field.queens, ...field.kings, ...field.glasses];
}

/**
 * A queen protects all your *other* cards from single-target effects (Twos,
 * Nines, Jacks). A queen never protects herself. So a card is protected when
 * its owner controls a queen that is not the card itself.
 */
export function isProtectedByQueen(field: Field, target: FieldCard): boolean {
  return field.queens.some((q) => q !== target);
}

export type CuttlePhase =
  | "PLAYER_TURN"
  | "BOT_TURN"
  | "PLAYER_COUNTER"
  | "PLAYER_DISCARD"
  | "PLAYER_SEVEN"
  | "GAME_OVER";

/** A one-off in flight: the base card plus any stacked countering Twos. */
export interface OneOffInFlight {
  /** stack[0] is the base one-off; the rest are countering Twos. */
  stack: PlayingCard[];
  by: Player;
  targetKey: string | null;
}

export interface CuttleState extends BaseGameState {
  phase: CuttlePhase;
  deck: PlayingCard[];
  scrap: PlayingCard[];
  hands: Record<Player, PlayingCard[]>;
  fields: Record<Player, Field>;
  turn: Player;
  oneOff: OneOffInFlight | null;
  /** Who must now decide whether to counter the pending one-off. */
  counterDecider: Player | null;
  /** The two cards revealed by a Seven, awaiting a choice. */
  sevenCards: PlayingCard[] | null;
  /** A card returned by a Nine, frozen for its owner's next turn. */
  frozenKey: string | null;
  frozenOwner: Player | null;
  /** How many cards the player must discard (Four played against them). */
  discardCount: number;
  /** Consecutive passes (only possible once the deck is empty). */
  passes: number;
  /** Who took the first turn this game (used to alternate on New Game). */
  starter: Player;
  winner: Player | null;
}

export function opponentOf(p: Player): Player {
  return p === "player" ? "computer" : "player";
}

// --- Pure target/action queries (shared by the engine and the bot) ---

/** Opponent point cards this number card can scuttle (queen does not protect). */
export function scuttleTargets(
  state: CuttleState,
  by: Player,
  card: PlayingCard,
): FieldCard[] {
  if (!isNumberCard(card)) return [];
  return state.fields[opponentOf(by)].points.filter((t) =>
    canScuttle(card, t.card),
  );
}

/** Opponent point cards a Jack can steal — none while they control a queen. */
export function jackTargets(state: CuttleState, by: Player): FieldCard[] {
  const opp = state.fields[opponentOf(by)];
  return opp.queens.length > 0 ? [] : opp.points;
}

/** Opponent royals/glasses a Two may scrap, respecting queen protection. */
export function twoTargets(state: CuttleState, by: Player): FieldCard[] {
  const opp = state.fields[opponentOf(by)];
  const royals = [...opp.kings, ...opp.queens, ...opp.glasses];
  return royals.filter((fc) => !isProtectedByQueen(opp, fc));
}

/** Opponent field cards a Nine may bounce, respecting queen protection. */
export function nineTargets(state: CuttleState, by: Player): FieldCard[] {
  const opp = state.fields[opponentOf(by)];
  return allFieldCards(opp).filter((fc) => !isProtectedByQueen(opp, fc));
}

export interface CardActions {
  points: boolean;
  scuttle: FieldCard[];
  glasses: boolean;
  jack: FieldCard[];
  king: boolean;
  queen: boolean;
  oneOff: { playable: boolean; needsTarget: boolean; targets: FieldCard[] };
}

/** Everything `card` (in `by`'s hand) could legally do this turn. */
export function cardActions(
  state: CuttleState,
  by: Player,
  card: PlayingCard,
): CardActions {
  const number = isNumberCard(card);
  const oneOff = {
    playable: false,
    needsTarget: false,
    targets: [] as FieldCard[],
  };

  if (hasOneOff(card)) {
    switch (card.cardName) {
      case CardName.Two:
        oneOff.needsTarget = true;
        oneOff.targets = twoTargets(state, by);
        oneOff.playable = oneOff.targets.length > 0;
        break;
      case CardName.Three:
        oneOff.needsTarget = true;
        // Targets live in the scrap pile, not the field.
        oneOff.playable = state.scrap.length > 0;
        break;
      case CardName.Nine:
        oneOff.needsTarget = true;
        oneOff.targets = nineTargets(state, by);
        oneOff.playable = oneOff.targets.length > 0;
        break;
      default: // Ace, Four, Five, Six, Seven — no target required
        oneOff.playable = true;
    }
  }

  return {
    points: number,
    scuttle: scuttleTargets(state, by, card),
    glasses: isEight(card),
    jack: isJack(card) ? jackTargets(state, by) : [],
    king: isKing(card),
    queen: isQueen(card),
    oneOff,
  };
}

export { cardKey };
