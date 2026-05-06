import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { optimalAction } from "../strategy";

function card(rank: CardName, suit: Suit = Suit.Spades): PlayingCard {
  return new PlayingCard(rank, suit);
}

describe("optimalAction", () => {
  test("hard 16 vs dealer 10 → hit", () => {
    const hand = [card(CardName.Ten), card(CardName.Six)];
    const upcard = card(CardName.Ten);
    expect(optimalAction(hand, upcard, false, true)).toBe("hit");
  });

  test("hard 16 vs dealer 6 → stand", () => {
    const hand = [card(CardName.Ten), card(CardName.Six)];
    const upcard = card(CardName.Six);
    expect(optimalAction(hand, upcard, false, true)).toBe("stand");
  });

  test("hard 11 vs dealer 6 → double", () => {
    const hand = [card(CardName.Six), card(CardName.Five)];
    const upcard = card(CardName.Six);
    expect(optimalAction(hand, upcard, false, true)).toBe("double");
  });

  test("hard 11 → hit when double not available", () => {
    const hand = [card(CardName.Six), card(CardName.Five)];
    const upcard = card(CardName.Six);
    expect(optimalAction(hand, upcard, false, false)).toBe("hit");
  });

  test("soft 18 vs dealer 9 → hit", () => {
    const hand = [card(CardName.Ace), card(CardName.Seven)];
    const upcard = card(CardName.Nine);
    expect(optimalAction(hand, upcard, false, true)).toBe("hit");
  });

  test("soft 18 vs dealer 6 → double", () => {
    const hand = [card(CardName.Ace), card(CardName.Seven)];
    const upcard = card(CardName.Six);
    expect(optimalAction(hand, upcard, false, true)).toBe("double");
  });

  test("soft 18 vs dealer 7 → stand", () => {
    const hand = [card(CardName.Ace), card(CardName.Seven)];
    const upcard = card(CardName.Seven);
    expect(optimalAction(hand, upcard, false, true)).toBe("stand");
  });

  test("pair of 8s vs dealer 10 → split", () => {
    const hand = [card(CardName.Eight, Suit.Hearts), card(CardName.Eight)];
    const upcard = card(CardName.Ten);
    expect(optimalAction(hand, upcard, true, true)).toBe("split");
  });

  test("pair of 10s vs dealer 5 → stand (never split tens)", () => {
    const hand = [card(CardName.Ten), card(CardName.Ten, Suit.Hearts)];
    const upcard = card(CardName.Five);
    expect(optimalAction(hand, upcard, true, true)).toBe("stand");
  });

  test("pair of Aces vs dealer Ace → split", () => {
    const hand = [card(CardName.Ace), card(CardName.Ace, Suit.Hearts)];
    const upcard = card(CardName.Ace, Suit.Diamonds);
    expect(optimalAction(hand, upcard, true, true)).toBe("split");
  });

  test("hard 12 vs dealer 2 → hit", () => {
    const hand = [card(CardName.Ten), card(CardName.Two)];
    const upcard = card(CardName.Two);
    expect(optimalAction(hand, upcard, false, true)).toBe("hit");
  });

  test("hard 12 vs dealer 4 → stand", () => {
    const hand = [card(CardName.Ten), card(CardName.Two)];
    const upcard = card(CardName.Four);
    expect(optimalAction(hand, upcard, false, true)).toBe("stand");
  });
});
