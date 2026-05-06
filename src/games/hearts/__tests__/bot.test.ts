import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { botChoosePass, botChoosePlay } from "../bot";
import type { HeartsState, PlayerIndex } from "../types";
import { sortByHearts } from "../types";
import { cardKey } from "../../../shared/deck";

function c(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

function emptyState(overrides: Partial<HeartsState>): HeartsState {
  return {
    phase: "PLAYING",
    message: "",
    hands: [[], [], [], []],
    scores: [0, 0, 0, 0],
    roundScores: [0, 0, 0, 0],
    voidSuits: [new Set(), new Set(), new Set(), new Set()],
    passDirection: "left",
    pendingPasses: [null, null, null, null],
    heartsBroken: false,
    currentTrick: null,
    completedTricks: [],
    currentTurn: 0,
    roundNumber: 1,
    roundResult: null,
    winner: null,
    ...overrides,
  };
}

describe("botChoosePass", () => {
  test("dumps unguarded Q♠", () => {
    const hand = [
      c(CardName.Queen, Suit.Spades),
      c(CardName.Two, Suit.Spades),
      c(CardName.Three, Suit.Diamonds),
      c(CardName.Four, Suit.Diamonds),
      c(CardName.Five, Suit.Diamonds),
      c(CardName.Six, Suit.Diamonds),
      c(CardName.Seven, Suit.Clubs),
      c(CardName.Eight, Suit.Clubs),
      c(CardName.Nine, Suit.Clubs),
      c(CardName.Ten, Suit.Clubs),
      c(CardName.Jack, Suit.Clubs),
      c(CardName.King, Suit.Clubs),
      c(CardName.Ace, Suit.Clubs),
    ];
    const idxs = botChoosePass(hand);
    expect(idxs).toHaveLength(3);
    const passedCards = idxs.map((i) => hand[i]!);
    expect(
      passedCards.some(
        (card) => card.suit === Suit.Spades && card.cardName === CardName.Queen,
      ),
    ).toBe(true);
  });

  test("keeps Q♠ when well guarded (4+ spades)", () => {
    const hand = [
      c(CardName.Queen, Suit.Spades),
      c(CardName.Two, Suit.Spades),
      c(CardName.Three, Suit.Spades),
      c(CardName.Four, Suit.Spades),
      c(CardName.Three, Suit.Diamonds),
      c(CardName.Four, Suit.Diamonds),
      c(CardName.Five, Suit.Diamonds),
      c(CardName.Six, Suit.Diamonds),
      c(CardName.Seven, Suit.Clubs),
      c(CardName.Eight, Suit.Clubs),
      c(CardName.Nine, Suit.Clubs),
      c(CardName.Ten, Suit.Clubs),
      c(CardName.Ace, Suit.Hearts),
    ];
    const idxs = botChoosePass(hand);
    const passedCards = idxs.map((i) => hand[i]!);
    expect(
      passedCards.some(
        (card) => card.suit === Suit.Spades && card.cardName === CardName.Queen,
      ),
    ).toBe(false);
  });

  test("returns 3 distinct indices", () => {
    const hand = Array.from({ length: 13 }, (_, i) =>
      c((i + 2) as CardName, Suit.Hearts),
    );
    const idxs = botChoosePass(hand);
    expect(new Set(idxs).size).toBe(3);
  });
});

describe("botChoosePlay", () => {
  test("leads lowest non-heart, non-Q♠", () => {
    const hand = [
      c(CardName.Two, Suit.Diamonds),
      c(CardName.Five, Suit.Clubs),
      c(CardName.Queen, Suit.Spades),
      c(CardName.Three, Suit.Hearts),
    ];
    sortByHearts(hand);
    const state = emptyState({
      hands: [[], hand, [], []],
      currentTrick: { leader: 1 as PlayerIndex, ledSuit: null, plays: [] },
      currentTurn: 1 as PlayerIndex,
      heartsBroken: true,
      completedTricks: [{ leader: 0, ledSuit: Suit.Clubs, plays: [] }] as never,
    });
    const card = botChoosePlay(state, 1 as PlayerIndex);
    expect(cardKey(card)).toBe(cardKey(c(CardName.Two, Suit.Diamonds)));
  });

  test("when void in led suit and holding Q♠, dumps Q♠", () => {
    const hand = [
      c(CardName.Queen, Suit.Spades),
      c(CardName.Three, Suit.Hearts),
      c(CardName.Two, Suit.Diamonds),
    ];
    const state = emptyState({
      hands: [[], hand, [], []],
      currentTrick: {
        leader: 0 as PlayerIndex,
        ledSuit: Suit.Clubs,
        plays: [
          { player: 0 as PlayerIndex, card: c(CardName.Five, Suit.Clubs) },
        ],
      },
      currentTurn: 1 as PlayerIndex,
      completedTricks: [{ leader: 0, ledSuit: Suit.Clubs, plays: [] }] as never,
    });
    const card = botChoosePlay(state, 1 as PlayerIndex);
    expect(card.suit).toBe(Suit.Spades);
    expect(card.cardName).toBe(CardName.Queen);
  });

  test("following with led suit and trick has points: plays highest losing card", () => {
    const hand = [
      c(CardName.Two, Suit.Clubs),
      c(CardName.Eight, Suit.Clubs),
      c(CardName.King, Suit.Clubs),
    ];
    const state = emptyState({
      hands: [[], hand, [], []],
      currentTrick: {
        leader: 0 as PlayerIndex,
        ledSuit: Suit.Clubs,
        plays: [
          { player: 0 as PlayerIndex, card: c(CardName.Ten, Suit.Clubs) },
          { player: 3 as PlayerIndex, card: c(CardName.Three, Suit.Hearts) },
        ],
      },
      currentTurn: 1 as PlayerIndex,
      completedTricks: [{ leader: 0, ledSuit: Suit.Clubs, plays: [] }] as never,
    });
    const card = botChoosePlay(state, 1 as PlayerIndex);
    expect(card.cardName).toBe(CardName.Eight);
  });
});
