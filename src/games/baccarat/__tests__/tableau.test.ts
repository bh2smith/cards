import { test, expect, describe } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import {
  bankerDraws,
  cardValue,
  handTotal,
  isNatural,
  playerDraws,
} from "../tableau";

function c(name: CardName, suit = Suit.Spades): PlayingCard {
  return { cardName: name, suit } as PlayingCard;
}

const A = c(CardName.Ace);
const TWO = c(CardName.Two);
const THREE = c(CardName.Three);
const FOUR = c(CardName.Four);
const FIVE = c(CardName.Five, Suit.Hearts);
const SIX = c(CardName.Six);
const SEVEN = c(CardName.Seven);
const EIGHT = c(CardName.Eight);
const NINE = c(CardName.Nine);
const TEN = c(CardName.Ten);
const J = c(CardName.Jack);
const Q = c(CardName.Queen);
const K = c(CardName.King);

describe("cardValue", () => {
  test("ace counts one", () => expect(cardValue(A)).toBe(1));
  test("pips count face value", () => {
    expect(cardValue(TWO)).toBe(2);
    expect(cardValue(NINE)).toBe(9);
  });
  test("tens and court cards count zero", () => {
    for (const card of [TEN, J, Q, K]) expect(cardValue(card)).toBe(0);
  });
});

describe("handTotal (mod 10)", () => {
  test("empty hand is zero", () => expect(handTotal([])).toBe(0));
  test("7 + 6 = 3", () => expect(handTotal([SEVEN, SIX])).toBe(3));
  test("K + Q = 0", () => expect(handTotal([K, Q])).toBe(0));
  test("A + 9 = 0", () => expect(handTotal([A, NINE])).toBe(0));
  test("9 + 9 = 8", () => expect(handTotal([NINE, NINE])).toBe(8));
  test("10 + 9 = 9", () => expect(handTotal([TEN, NINE])).toBe(9));
  test("5 + 5 + 5 = 5", () => expect(handTotal([FIVE, FIVE, FIVE])).toBe(5));
  test("A + A + A = 3", () => expect(handTotal([A, A, A])).toBe(3));
});

describe("isNatural", () => {
  test("two-card 8 and 9 are naturals", () => {
    expect(isNatural([FOUR, FOUR])).toBe(true);
    expect(isNatural([FOUR, FIVE])).toBe(true);
    expect(isNatural([K, EIGHT])).toBe(true);
  });
  test("two-card 7 is not", () => expect(isNatural([THREE, FOUR])).toBe(false));
  test("three-card 9 is not", () =>
    expect(isNatural([TWO, THREE, FOUR])).toBe(false));
});

describe("playerDraws", () => {
  test("draws on 0-5, stands on 6-7", () => {
    for (let total = 0; total <= 5; total++) {
      expect(playerDraws(total)).toBe(true);
    }
    expect(playerDraws(6)).toBe(false);
    expect(playerDraws(7)).toBe(false);
  });
});

describe("bankerDraws — the full tableau", () => {
  // Rows: banker total 3-6; columns: player third-card value 0-9.
  const D = true;
  const S = false;
  const ROWS: Record<number, boolean[]> = {
    3: [D, D, D, D, D, D, D, D, S, D],
    4: [S, S, D, D, D, D, D, D, S, S],
    5: [S, S, S, S, D, D, D, D, S, S],
    6: [S, S, S, S, S, S, D, D, S, S],
  };

  test("banker 0-2 always draws", () => {
    for (let total = 0; total <= 2; total++) {
      for (let third = 0; third <= 9; third++) {
        expect(bankerDraws(total, third)).toBe(true);
      }
    }
  });

  for (const [total, row] of Object.entries(ROWS)) {
    test(`banker ${total} follows the table`, () => {
      row.forEach((draws, third) => {
        expect(bankerDraws(Number(total), third)).toBe(draws);
      });
    });
  }

  test("banker 7 always stands", () => {
    for (let third = 0; third <= 9; third++) {
      expect(bankerDraws(7, third)).toBe(false);
    }
    expect(bankerDraws(7, null)).toBe(false);
  });

  test("player stood: banker draws 0-5, stands 6-7", () => {
    for (let total = 0; total <= 5; total++) {
      expect(bankerDraws(total, null)).toBe(true);
    }
    expect(bankerDraws(6, null)).toBe(false);
    expect(bankerDraws(7, null)).toBe(false);
  });
});
