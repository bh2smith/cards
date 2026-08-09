import { test, expect, describe } from "bun:test";
import { CardName, PlayingCard, Suit } from "typedeck";
import { cardOrder } from "../../deck";
import { findAllRuns, findAllSets, findBestMelds, findLayoffs } from "../melds";

function c(name: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(name, suit);
}

const pip = (card: PlayingCard) => Math.min(10, cardOrder(card));

describe("findAllRuns options", () => {
  const qka = [
    c(CardName.Queen, Suit.Spades),
    c(CardName.King, Suit.Spades),
    c(CardName.Ace, Suit.Spades),
  ];

  test("ace-low only: Q-K-A is not a run", () => {
    expect(findAllRuns(qka)).toHaveLength(0);
  });

  test("aceHigh: Q-K-A is a run", () => {
    expect(findAllRuns(qka, { aceHigh: true })).toHaveLength(1);
  });

  test("roundTheCorner: K-A-2 wraps", () => {
    const ka2 = [
      c(CardName.King, Suit.Hearts),
      c(CardName.Ace, Suit.Hearts),
      c(CardName.Two, Suit.Hearts),
    ];
    expect(findAllRuns(ka2)).toHaveLength(0);
    const runs = findAllRuns(ka2, { roundTheCorner: true });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.cards).toHaveLength(3);
  });

  test("wrap pass does not duplicate linear or aceHigh runs", () => {
    const a23 = [
      c(CardName.Ace, Suit.Clubs),
      c(CardName.Two, Suit.Clubs),
      c(CardName.Three, Suit.Clubs),
    ];
    expect(findAllRuns(a23, { roundTheCorner: true })).toHaveLength(1);
  });

  test("minLength is honored", () => {
    const four = [
      c(CardName.Four, Suit.Clubs),
      c(CardName.Five, Suit.Clubs),
      c(CardName.Six, Suit.Clubs),
      c(CardName.Seven, Suit.Clubs),
    ];
    const runs4 = findAllRuns(four, { minLength: 4 });
    expect(runs4).toHaveLength(1);
    expect(runs4[0]!.cards).toHaveLength(4);
  });
});

describe("findBestMelds", () => {
  test("prefers the partition with least deadwood", () => {
    // 7♣ can join the set of 7s or the 5-6-7 run; the run frees the other 7s…
    const hand = [
      c(CardName.Seven, Suit.Clubs),
      c(CardName.Seven, Suit.Hearts),
      c(CardName.Seven, Suit.Spades),
      c(CardName.Five, Suit.Clubs),
      c(CardName.Six, Suit.Clubs),
      c(CardName.Ten, Suit.Diamonds),
    ];
    const { melds, deadwood } = findBestMelds(hand, pip);
    // Best: set of three 7s leaves 5♣+6♣+10♦ (21) vs run 5-6-7 leaves 7♥+7♠+10♦ (24).
    expect(melds).toHaveLength(1);
    expect(melds[0]!.type).toBe("set");
    expect(deadwood).toHaveLength(3);
  });
});

describe("findLayoffs with options", () => {
  test("ace lays off on a K-high run only when aceHigh", () => {
    const meld = {
      type: "run" as const,
      cards: [
        c(CardName.Jack, Suit.Spades),
        c(CardName.Queen, Suit.Spades),
        c(CardName.King, Suit.Spades),
      ],
    };
    const ace = [c(CardName.Ace, Suit.Spades)];
    expect(findLayoffs(ace, [meld])).toHaveLength(0);
    expect(findLayoffs(ace, [meld], { aceHigh: true })).toHaveLength(1);
  });

  test("sets still cap at four cards", () => {
    const meld = {
      type: "set" as const,
      cards: [
        c(CardName.Nine, Suit.Clubs),
        c(CardName.Nine, Suit.Hearts),
        c(CardName.Nine, Suit.Spades),
        c(CardName.Nine, Suit.Diamonds),
      ],
    };
    expect(findLayoffs([c(CardName.Nine, Suit.Clubs)], [meld])).toHaveLength(0);
  });
});

describe("findAllSets", () => {
  test("four of a kind yields the quad and each triple", () => {
    const hand = [
      c(CardName.King, Suit.Clubs),
      c(CardName.King, Suit.Hearts),
      c(CardName.King, Suit.Spades),
      c(CardName.King, Suit.Diamonds),
    ];
    expect(findAllSets(hand)).toHaveLength(5);
  });
});
