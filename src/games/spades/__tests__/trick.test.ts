import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { legalPlays, trickWinner } from "../trick";
import type { PlayerIndex, Trick } from "../types";

function c(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

function trickLed(card: PlayingCard): Trick {
  return { leader: 1, plays: [{ player: 1, card }], winner: null };
}

describe("legalPlays — leading", () => {
  const mixed = [
    c(CardName.Ace, Suit.Spades),
    c(CardName.Four, Suit.Spades),
    c(CardName.King, Suit.Hearts),
    c(CardName.Two, Suit.Clubs),
  ];

  test("spades may not be led before they are broken", () => {
    expect(legalPlays(mixed, null, false)).toEqual([
      c(CardName.King, Suit.Hearts),
      c(CardName.Two, Suit.Clubs),
    ]);
  });

  test("spades may be led once broken", () => {
    expect(legalPlays(mixed, null, true)).toEqual(mixed);
  });

  test("an empty in-progress trick counts as leading", () => {
    const empty: Trick = { leader: 0, plays: [], winner: null };
    expect(legalPlays(mixed, empty, false)).toEqual([
      c(CardName.King, Suit.Hearts),
      c(CardName.Two, Suit.Clubs),
    ]);
  });

  test("a spades-only hand may lead spades even unbroken", () => {
    const onlySpades = [
      c(CardName.Ace, Suit.Spades),
      c(CardName.Three, Suit.Spades),
    ];
    expect(legalPlays(onlySpades, null, false)).toEqual(onlySpades);
  });
});

describe("legalPlays — following suit", () => {
  test("must follow the led suit when able", () => {
    const hand = [
      c(CardName.Ace, Suit.Spades),
      c(CardName.Nine, Suit.Hearts),
      c(CardName.Two, Suit.Hearts),
      c(CardName.King, Suit.Diamonds),
    ];
    const trick = trickLed(c(CardName.Queen, Suit.Hearts));
    expect(legalPlays(hand, trick, false)).toEqual([
      c(CardName.Nine, Suit.Hearts),
      c(CardName.Two, Suit.Hearts),
    ]);
  });

  test("void in the led suit allows anything, including unbroken spades", () => {
    const hand = [
      c(CardName.Ace, Suit.Spades),
      c(CardName.King, Suit.Diamonds),
    ];
    const trick = trickLed(c(CardName.Queen, Suit.Hearts));
    expect(legalPlays(hand, trick, false)).toEqual(hand);
  });

  test("spade lead must be followed with spades", () => {
    const hand = [c(CardName.Ten, Suit.Spades), c(CardName.Ace, Suit.Hearts)];
    const trick = trickLed(c(CardName.Two, Suit.Spades));
    expect(legalPlays(hand, trick, true)).toEqual([
      c(CardName.Ten, Suit.Spades),
    ]);
  });
});

describe("trickWinner", () => {
  test("a small spade beats the led ace", () => {
    const trick: Trick = {
      leader: 0,
      winner: null,
      plays: [
        { player: 0, card: c(CardName.Ace, Suit.Hearts) },
        { player: 1, card: c(CardName.King, Suit.Hearts) },
        { player: 2, card: c(CardName.Two, Suit.Spades) },
        { player: 3, card: c(CardName.Queen, Suit.Hearts) },
      ],
    };
    expect(trickWinner(trick)).toBe(2 as PlayerIndex);
  });

  test("highest of the led suit wins when no spade is played", () => {
    const trick: Trick = {
      leader: 0,
      winner: null,
      plays: [
        { player: 0, card: c(CardName.Ten, Suit.Clubs) },
        { player: 1, card: c(CardName.Ace, Suit.Clubs) },
        { player: 2, card: c(CardName.Ace, Suit.Diamonds) }, // off-suit, can't win
        { player: 3, card: c(CardName.King, Suit.Clubs) },
      ],
    };
    expect(trickWinner(trick)).toBe(1 as PlayerIndex);
  });

  test("highest spade wins when several are played", () => {
    const trick: Trick = {
      leader: 0,
      winner: null,
      plays: [
        { player: 0, card: c(CardName.Nine, Suit.Diamonds) },
        { player: 1, card: c(CardName.Five, Suit.Spades) },
        { player: 2, card: c(CardName.Jack, Suit.Spades) },
        { player: 3, card: c(CardName.Ten, Suit.Spades) },
      ],
    };
    expect(trickWinner(trick)).toBe(2 as PlayerIndex);
  });

  test("ace is high within the led suit", () => {
    const trick: Trick = {
      leader: 0,
      winner: null,
      plays: [
        { player: 0, card: c(CardName.King, Suit.Hearts) },
        { player: 1, card: c(CardName.Ace, Suit.Hearts) },
        { player: 2, card: c(CardName.Two, Suit.Hearts) },
        { player: 3, card: c(CardName.Queen, Suit.Hearts) },
      ],
    };
    expect(trickWinner(trick)).toBe(1 as PlayerIndex);
  });
});
