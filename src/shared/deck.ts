import { CardName, Suit, type PlayingCard, Deck } from "typedeck";

const ALL_SUITS = [Suit.Clubs, Suit.Spades, Suit.Diamonds, Suit.Hearts];
const ALL_RANKS = [
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

export const SUIT_SYMBOL: Record<number, string> = {
  [Suit.Clubs]: "♣",
  [Suit.Spades]: "♠",
  [Suit.Diamonds]: "♦",
  [Suit.Hearts]: "♥",
};

export const RANK_DISPLAY: Record<number, string> = {
  [CardName.Ace]: "A",
  [CardName.Two]: "2",
  [CardName.Three]: "3",
  [CardName.Four]: "4",
  [CardName.Five]: "5",
  [CardName.Six]: "6",
  [CardName.Seven]: "7",
  [CardName.Eight]: "8",
  [CardName.Nine]: "9",
  [CardName.Ten]: "10",
  [CardName.Jack]: "J",
  [CardName.Queen]: "Q",
  [CardName.King]: "K",
};

export function isRed(card: PlayingCard): boolean {
  return card.suit === Suit.Diamonds || card.suit === Suit.Hearts;
}

export function cardKey(card: PlayingCard): string {
  return `${card.cardName}-${card.suit}`;
}

export function cardOrder(card: PlayingCard): number {
  return card.cardName + 1; // A=1, 2=2, ..., K=13
}

export function createDeck(): PlayingCard[] {
  const deck = Deck.Build(ALL_SUITS, ALL_RANKS);
  return [...deck.getCards()] as PlayingCard[];
}

/** Deterministic PRNG (mulberry32) so a numeric seed replays the same deal. */
export function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}
