import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import {
  findAllSets,
  findAllRuns,
  findBestMelds,
  deadwoodValue,
  calculateDeadwood,
  canKnock,
  isGin,
  findLayoffs,
} from "../melds";
import { pipValue } from "../types";
import { cardKey } from "../../../shared/deck";

function card(rank: CardName, suit: Suit = Suit.Spades): PlayingCard {
  return new PlayingCard(rank, suit);
}

describe("pipValue", () => {
  test("ace is 1", () => {
    expect(pipValue(card(CardName.Ace))).toBe(1);
  });

  test("number cards equal their rank", () => {
    expect(pipValue(card(CardName.Five))).toBe(5);
    expect(pipValue(card(CardName.Nine))).toBe(9);
  });

  test("face cards are 10", () => {
    expect(pipValue(card(CardName.Ten))).toBe(10);
    expect(pipValue(card(CardName.Jack))).toBe(10);
    expect(pipValue(card(CardName.Queen))).toBe(10);
    expect(pipValue(card(CardName.King))).toBe(10);
  });
});

describe("findAllSets", () => {
  test("finds a three-of-a-kind", () => {
    const hand = [
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Clubs),
      card(CardName.Seven, Suit.Diamonds),
      card(CardName.King, Suit.Spades),
    ];
    const sets = findAllSets(hand);
    expect(sets.length).toBe(1);
    expect(sets[0]!.type).toBe("set");
    expect(sets[0]!.cards.length).toBe(3);
  });

  test("finds four-of-a-kind and its 3-card subsets", () => {
    const hand = [
      card(CardName.Five, Suit.Hearts),
      card(CardName.Five, Suit.Clubs),
      card(CardName.Five, Suit.Diamonds),
      card(CardName.Five, Suit.Spades),
    ];
    const sets = findAllSets(hand);
    expect(sets.length).toBe(5); // 1 four-of-a-kind + 4 three-card subsets
  });

  test("returns empty for pairs", () => {
    const hand = [
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Ace, Suit.Clubs),
      card(CardName.King, Suit.Spades),
    ];
    expect(findAllSets(hand).length).toBe(0);
  });
});

describe("findAllRuns", () => {
  test("finds a 3-card run", () => {
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Four, Suit.Hearts),
      card(CardName.Five, Suit.Hearts),
    ];
    const runs = findAllRuns(hand);
    expect(runs.length).toBe(1);
    expect(runs[0]!.type).toBe("run");
    expect(runs[0]!.cards.length).toBe(3);
  });

  test("finds sub-runs within a longer run", () => {
    const hand = [
      card(CardName.Three, Suit.Clubs),
      card(CardName.Four, Suit.Clubs),
      card(CardName.Five, Suit.Clubs),
      card(CardName.Six, Suit.Clubs),
    ];
    const runs = findAllRuns(hand);
    // 4-card run + two 3-card sub-runs
    expect(runs.length).toBe(3);
  });

  test("does not form runs across suits", () => {
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Four, Suit.Clubs),
      card(CardName.Five, Suit.Hearts),
    ];
    expect(findAllRuns(hand).length).toBe(0);
  });

  test("ace-two-three is a valid run", () => {
    const hand = [
      card(CardName.Ace, Suit.Diamonds),
      card(CardName.Two, Suit.Diamonds),
      card(CardName.Three, Suit.Diamonds),
    ];
    const runs = findAllRuns(hand);
    expect(runs.length).toBe(1);
  });
});

describe("findBestMelds", () => {
  test("chooses melds that minimize deadwood", () => {
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Four, Suit.Hearts),
      card(CardName.Five, Suit.Hearts),
      card(CardName.King, Suit.Spades),
      card(CardName.King, Suit.Hearts),
      card(CardName.King, Suit.Clubs),
      card(CardName.Two, Suit.Diamonds),
      card(CardName.Seven, Suit.Clubs),
      card(CardName.Nine, Suit.Spades),
      card(CardName.Ace, Suit.Clubs),
    ];
    const result = findBestMelds(hand);
    expect(result.melds.length).toBe(2);
    const dwValue = deadwoodValue(result.deadwood);
    expect(dwValue).toBe(2 + 7 + 9 + 1); // 19
  });

  test("perfect gin hand has zero deadwood", () => {
    const hand = [
      card(CardName.Ace, Suit.Spades),
      card(CardName.Two, Suit.Spades),
      card(CardName.Three, Suit.Spades),
      card(CardName.Four, Suit.Hearts),
      card(CardName.Four, Suit.Diamonds),
      card(CardName.Four, Suit.Clubs),
      card(CardName.Ten, Suit.Hearts),
      card(CardName.Jack, Suit.Hearts),
      card(CardName.Queen, Suit.Hearts),
      card(CardName.King, Suit.Hearts),
    ];
    const result = findBestMelds(hand);
    expect(result.deadwood.length).toBe(0);
    expect(deadwoodValue(result.deadwood)).toBe(0);
  });
});

describe("deadwoodValue", () => {
  test("sums pip values", () => {
    const cards = [
      card(CardName.King, Suit.Spades),
      card(CardName.Ace, Suit.Hearts),
    ];
    expect(deadwoodValue(cards)).toBe(11);
  });

  test("empty array is 0", () => {
    expect(deadwoodValue([])).toBe(0);
  });
});

describe("calculateDeadwood", () => {
  test("accounts for melds", () => {
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Four, Suit.Hearts),
      card(CardName.Five, Suit.Hearts),
      card(CardName.Ace, Suit.Clubs),
    ];
    // run of 3-4-5 melded, deadwood is just the ace = 1
    expect(calculateDeadwood(hand)).toBe(1);
  });
});

describe("canKnock", () => {
  test("can knock with deadwood <= 10", () => {
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Four, Suit.Hearts),
      card(CardName.Five, Suit.Hearts),
      card(CardName.King, Suit.Spades),
      card(CardName.King, Suit.Hearts),
      card(CardName.King, Suit.Clubs),
      card(CardName.Two, Suit.Diamonds),
      card(CardName.Ace, Suit.Clubs),
      card(CardName.Three, Suit.Diamonds),
      card(CardName.Four, Suit.Diamonds),
    ];
    // melds: 3-4-5 hearts, K-K-K; deadwood: 2+1+3+4 = 10
    expect(canKnock(hand)).toBe(true);
  });

  test("cannot knock with deadwood > 10", () => {
    const hand = [
      card(CardName.King, Suit.Spades),
      card(CardName.Queen, Suit.Clubs),
      card(CardName.Jack, Suit.Diamonds),
      card(CardName.Nine, Suit.Hearts),
      card(CardName.Eight, Suit.Clubs),
      card(CardName.Seven, Suit.Spades),
      card(CardName.Six, Suit.Diamonds),
      card(CardName.Five, Suit.Hearts),
      card(CardName.Four, Suit.Clubs),
      card(CardName.Three, Suit.Spades),
    ];
    expect(canKnock(hand)).toBe(false);
  });
});

describe("isGin", () => {
  test("returns true for perfect hand", () => {
    const hand = [
      card(CardName.Ace, Suit.Spades),
      card(CardName.Two, Suit.Spades),
      card(CardName.Three, Suit.Spades),
      card(CardName.Four, Suit.Hearts),
      card(CardName.Four, Suit.Diamonds),
      card(CardName.Four, Suit.Clubs),
      card(CardName.Ten, Suit.Hearts),
      card(CardName.Jack, Suit.Hearts),
      card(CardName.Queen, Suit.Hearts),
      card(CardName.King, Suit.Hearts),
    ];
    expect(isGin(hand)).toBe(true);
  });

  test("returns false with deadwood", () => {
    const hand = [
      card(CardName.Ace, Suit.Spades),
      card(CardName.Two, Suit.Spades),
      card(CardName.Three, Suit.Spades),
      card(CardName.King, Suit.Diamonds),
    ];
    expect(isGin(hand)).toBe(false);
  });
});

describe("findLayoffs", () => {
  test("lays off cards onto sets", () => {
    const knockerMelds = [
      {
        type: "set" as const,
        cards: [
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Seven, Suit.Clubs),
          card(CardName.Seven, Suit.Diamonds),
        ],
      },
    ];
    const defenderDeadwood = [
      card(CardName.Seven, Suit.Spades),
      card(CardName.King, Suit.Spades),
    ];

    const layoffs = findLayoffs(defenderDeadwood, knockerMelds);
    expect(layoffs.length).toBe(1);
    expect(layoffs[0]!.cardName).toBe(CardName.Seven);
  });

  test("lays off cards onto runs", () => {
    const knockerMelds = [
      {
        type: "run" as const,
        cards: [
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
        ],
      },
    ];
    const defenderDeadwood = [
      card(CardName.Four, Suit.Hearts),
      card(CardName.Eight, Suit.Hearts),
      card(CardName.King, Suit.Spades),
    ];

    const layoffs = findLayoffs(defenderDeadwood, knockerMelds);
    expect(layoffs.length).toBe(2);
    const keys = new Set(layoffs.map(cardKey));
    expect(keys.has(cardKey(card(CardName.Four, Suit.Hearts)))).toBe(true);
    expect(keys.has(cardKey(card(CardName.Eight, Suit.Hearts)))).toBe(true);
  });

  test("does not lay off onto full sets", () => {
    const knockerMelds = [
      {
        type: "set" as const,
        cards: [
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Seven, Suit.Clubs),
          card(CardName.Seven, Suit.Diamonds),
          card(CardName.Seven, Suit.Spades),
        ],
      },
    ];
    const defenderDeadwood = [card(CardName.King, Suit.Spades)];
    const layoffs = findLayoffs(defenderDeadwood, knockerMelds);
    expect(layoffs.length).toBe(0);
  });
});
