import { test, expect, describe } from "bun:test";
import { PlayingCard, CardName, Suit } from "typedeck";
import { chooseDiscards, choosePeggingCard } from "../ai";

function card(name: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(name, suit);
}

describe("chooseDiscards", () => {
  test("returns two indices", () => {
    const hand = [
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Two, Suit.Diamonds),
      card(CardName.Three, Suit.Clubs),
      card(CardName.Four, Suit.Spades),
      card(CardName.King, Suit.Hearts),
      card(CardName.Queen, Suit.Diamonds),
    ];
    const [a, b] = chooseDiscards(hand, false);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(6);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(6);
    expect(a).not.toBe(b);
  });

  test("keeps high-scoring cards together", () => {
    const hand = [
      card(CardName.Five, Suit.Hearts),
      card(CardName.Five, Suit.Diamonds),
      card(CardName.Five, Suit.Clubs),
      card(CardName.Jack, Suit.Spades),
      card(CardName.Two, Suit.Hearts),
      card(CardName.Nine, Suit.Diamonds),
    ];
    const discards = chooseDiscards(hand, false);
    // Should discard the 2 and 9, keeping 5-5-5-J
    expect(discards.sort()).toEqual([4, 5]);
  });
});

describe("choosePeggingCard", () => {
  test("returns null when no card can play", () => {
    const hand = [card(CardName.King, Suit.Hearts)];
    const result = choosePeggingCard(hand, [], 25);
    expect(result).toBeNull();
  });

  test("returns a playable card", () => {
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
    ];
    const result = choosePeggingCard(hand, [], 0);
    expect(result).not.toBeNull();
  });

  test("prefers playing to 15", () => {
    const hand = [
      card(CardName.Eight, Suit.Hearts),
      card(CardName.Two, Suit.Diamonds),
    ];
    const pile = [card(CardName.Seven, Suit.Clubs)];
    const result = choosePeggingCard(hand, pile, 7);
    expect(result?.cardName).toBe(CardName.Eight);
  });

  test("prefers playing to 31", () => {
    const hand = [
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Five, Suit.Diamonds),
    ];
    const pile = [card(CardName.Ten, Suit.Clubs)];
    const result = choosePeggingCard(hand, pile, 30);
    expect(result?.cardName).toBe(CardName.Ace);
  });
});
