import { CardName, Suit, PlayingCard } from "typedeck";

/**
 * Microsoft-compatible FreeCell deal generator. Deal numbers reproduce the
 * exact layouts from the classic Windows FreeCell (e.g. #1, #617, #11982), so
 * a deal number is a stable, replayable seed.
 *
 * Algorithm: a linear-congruential RNG seeded by the deal number deals 52 cards
 * round-robin into 8 columns. Cards 0..51 are ordered rank-major (A..K), suit
 * within rank as Clubs, Diamonds, Hearts, Spades.
 */

export const TABLEAU_COLS = 8;

const MS_SUITS = [Suit.Clubs, Suit.Diamonds, Suit.Hearts, Suit.Spades];
const MS_RANKS = [
  CardName.Ace,
  CardName.Two,
  CardName.Three,
  CardName.Four,
  CardName.Five,
  CardName.Six,
  CardName.Seven,
  CardName.Eight,
  CardName.Nine,
  CardName.Ten,
  CardName.Jack,
  CardName.Queen,
  CardName.King,
];

export const MIN_DEAL = 1;
export const MAX_DEAL = 1_000_000;

export function dealColumns(dealNumber: number): PlayingCard[][] {
  const deck: PlayingCard[] = [];
  for (let i = 0; i < 52; i++) {
    const suit = MS_SUITS[i % 4]!;
    const rank = MS_RANKS[Math.floor(i / 4)]!;
    deck.push(new PlayingCard(rank, suit));
  }

  let seed = dealNumber >>> 0;
  const rand = (): number => {
    seed = (seed * 214013 + 2531011) & 0x7fffffff;
    return (seed >> 16) & 0x7fff;
  };

  const columns: PlayingCard[][] = Array.from(
    { length: TABLEAU_COLS },
    () => [],
  );
  let remaining = 52;
  for (let i = 0; i < 52; i++) {
    const j = rand() % remaining;
    columns[i % TABLEAU_COLS]!.push(deck[j]!);
    deck[j] = deck[remaining - 1]!;
    remaining--;
  }
  return columns;
}
