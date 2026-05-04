import { test, expect, describe } from "bun:test";
import { PlayingCard, CardName, Suit } from "typedeck";
import { scoreShowHand, scorePeggingPlay, canPlay } from "../scoring";
import { peggingValue } from "../types";

function card(name: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(name, suit);
}

describe("scoreShowHand", () => {
  test("scores a perfect 29 hand", () => {
    const hand = [
      card(CardName.Five, Suit.Hearts),
      card(CardName.Five, Suit.Diamonds),
      card(CardName.Five, Suit.Clubs),
      card(CardName.Jack, Suit.Spades),
    ];
    const starter = card(CardName.Five, Suit.Spades);
    const result = scoreShowHand(hand, starter, false);
    expect(result.score).toBe(29);
  });

  test("scores fifteens", () => {
    const hand = [
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Eight, Suit.Diamonds),
      card(CardName.Nine, Suit.Clubs),
      card(CardName.Ten, Suit.Spades),
    ];
    const starter = card(CardName.Two, Suit.Hearts);
    const result = scoreShowHand(hand, starter, false);
    const fifteens = result.points.filter((p) => p.name === "Fifteen");
    expect(fifteens.length).toBeGreaterThan(0);
  });

  test("scores a run of 3", () => {
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Four, Suit.Diamonds),
      card(CardName.Five, Suit.Clubs),
      card(CardName.King, Suit.Spades),
    ];
    const starter = card(CardName.King, Suit.Hearts);
    const result = scoreShowHand(hand, starter, false);
    const runs = result.points.filter((p) => p.name.startsWith("Run"));
    expect(runs.length).toBeGreaterThan(0);
  });

  test("scores pairs", () => {
    const hand = [
      card(CardName.Nine, Suit.Hearts),
      card(CardName.Nine, Suit.Diamonds),
      card(CardName.Two, Suit.Clubs),
      card(CardName.Three, Suit.Spades),
    ];
    const starter = card(CardName.King, Suit.Hearts);
    const result = scoreShowHand(hand, starter, false);
    const pairs = result.points.filter((p) => p.name === "Pair");
    expect(pairs.length).toBe(1);
    expect(pairs[0].points).toBe(2);
  });

  test("scores flush in hand (4 cards)", () => {
    const hand = [
      card(CardName.Two, Suit.Hearts),
      card(CardName.Six, Suit.Hearts),
      card(CardName.Nine, Suit.Hearts),
      card(CardName.King, Suit.Hearts),
    ];
    const starter = card(CardName.Three, Suit.Spades);
    const result = scoreShowHand(hand, starter, false);
    const flush = result.points.filter((p) => p.name.startsWith("Flush"));
    expect(flush.length).toBe(1);
    expect(flush[0].points).toBe(4);
  });

  test("crib flush requires all 5 cards", () => {
    const hand = [
      card(CardName.Two, Suit.Hearts),
      card(CardName.Six, Suit.Hearts),
      card(CardName.Nine, Suit.Hearts),
      card(CardName.King, Suit.Hearts),
    ];
    const starter = card(CardName.Three, Suit.Spades);
    const result = scoreShowHand(hand, starter, true);
    const flush = result.points.filter((p) => p.name.startsWith("Flush"));
    expect(flush.length).toBe(0);
  });

  test("scores nobs", () => {
    const hand = [
      card(CardName.Jack, Suit.Hearts),
      card(CardName.Two, Suit.Clubs),
      card(CardName.Three, Suit.Spades),
      card(CardName.Four, Suit.Diamonds),
    ];
    const starter = card(CardName.King, Suit.Hearts);
    const result = scoreShowHand(hand, starter, false);
    const nobs = result.points.filter((p) => p.name === "Nobs");
    expect(nobs.length).toBe(1);
  });

  test("zero-point hand", () => {
    // A+3+6+7+K with no flush, no pairs, no runs, no 15s, no nobs
    const hand = [
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Three, Suit.Diamonds),
      card(CardName.Six, Suit.Clubs),
      card(CardName.Seven, Suit.Spades),
    ];
    const starter = card(CardName.King, Suit.Diamonds);
    const result = scoreShowHand(hand, starter, false);
    expect(result.score).toBe(0);
  });
});

describe("scorePeggingPlay", () => {
  test("scores fifteen", () => {
    const pile = [
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Eight, Suit.Diamonds),
    ];
    const { points, details } = scorePeggingPlay(pile, 15);
    expect(points).toBe(2);
    expect(details).toContain("Fifteen for 2");
  });

  test("scores thirty-one", () => {
    const pile = [
      card(CardName.Ten, Suit.Hearts),
      card(CardName.Ten, Suit.Diamonds),
      card(CardName.Ten, Suit.Clubs),
      card(CardName.Ace, Suit.Spades),
    ];
    const { points, details } = scorePeggingPlay(pile, 31);
    expect(points).toBe(2);
    expect(details).toContain("Thirty-one for 2");
  });

  test("scores a pair", () => {
    const pile = [
      card(CardName.Five, Suit.Hearts),
      card(CardName.Five, Suit.Diamonds),
    ];
    const { points, details } = scorePeggingPlay(pile, 10);
    expect(points).toBe(2);
    expect(details).toContain("Pair for 2");
  });

  test("scores three of a kind", () => {
    const pile = [
      card(CardName.Four, Suit.Hearts),
      card(CardName.Four, Suit.Diamonds),
      card(CardName.Four, Suit.Clubs),
    ];
    const { points, details } = scorePeggingPlay(pile, 12);
    expect(points).toBe(6);
    expect(details).toContain("Three of a kind for 6");
  });

  test("scores a pegging run", () => {
    const pile = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Five, Suit.Diamonds),
      card(CardName.Four, Suit.Clubs),
    ];
    const { points, details } = scorePeggingPlay(pile, 12);
    expect(points).toBe(3);
    expect(details).toContain("Run of 3 for 3");
  });

  test("no points on empty pile", () => {
    const { points } = scorePeggingPlay([], 0);
    expect(points).toBe(0);
  });
});

describe("peggingValue", () => {
  test("ace is 1", () => {
    expect(peggingValue(card(CardName.Ace, Suit.Hearts))).toBe(1);
  });

  test("face cards are 10", () => {
    expect(peggingValue(card(CardName.Jack, Suit.Hearts))).toBe(10);
    expect(peggingValue(card(CardName.Queen, Suit.Hearts))).toBe(10);
    expect(peggingValue(card(CardName.King, Suit.Hearts))).toBe(10);
  });

  test("number cards are face value", () => {
    expect(peggingValue(card(CardName.Five, Suit.Hearts))).toBe(5);
    expect(peggingValue(card(CardName.Ten, Suit.Hearts))).toBe(10);
  });
});

describe("canPlay", () => {
  test("true when a card fits under 31", () => {
    const hand = [card(CardName.Ace, Suit.Hearts)];
    expect(canPlay(hand, 30)).toBe(true);
  });

  test("false when no card fits", () => {
    const hand = [card(CardName.Two, Suit.Hearts)];
    expect(canPlay(hand, 30)).toBe(false);
  });

  test("false on empty hand", () => {
    expect(canPlay([], 0)).toBe(false);
  });
});
