import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import {
  cardStrength,
  effectiveSuit,
  isLeftBower,
  isRightBower,
  isTrump,
  sameColorSuit,
} from "../types";

function c(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

describe("bowers", () => {
  test("right bower is the jack of trump", () => {
    expect(isRightBower(c(CardName.Jack, Suit.Spades), Suit.Spades)).toBe(true);
    expect(isRightBower(c(CardName.Jack, Suit.Clubs), Suit.Spades)).toBe(false);
  });

  test("left bower is the jack of the same color", () => {
    expect(isLeftBower(c(CardName.Jack, Suit.Clubs), Suit.Spades)).toBe(true);
    expect(isLeftBower(c(CardName.Jack, Suit.Diamonds), Suit.Hearts)).toBe(
      true,
    );
    expect(isLeftBower(c(CardName.Jack, Suit.Hearts), Suit.Spades)).toBe(false);
  });

  test("sameColorSuit pairs colors", () => {
    expect(sameColorSuit(Suit.Hearts)).toBe(Suit.Diamonds);
    expect(sameColorSuit(Suit.Diamonds)).toBe(Suit.Hearts);
    expect(sameColorSuit(Suit.Clubs)).toBe(Suit.Spades);
    expect(sameColorSuit(Suit.Spades)).toBe(Suit.Clubs);
  });
});

describe("effective suit and trump membership", () => {
  test("left bower plays as trump, not its printed suit", () => {
    const leftBower = c(CardName.Jack, Suit.Clubs); // trump = Spades
    expect(effectiveSuit(leftBower, Suit.Spades)).toBe(Suit.Spades);
    expect(isTrump(leftBower, Suit.Spades)).toBe(true);
  });

  test("an ordinary jack keeps its suit", () => {
    const jd = c(CardName.Jack, Suit.Diamonds); // trump = Spades
    expect(effectiveSuit(jd, Suit.Spades)).toBe(Suit.Diamonds);
    expect(isTrump(jd, Suit.Spades)).toBe(false);
  });
});

describe("cardStrength ordering (trump = Spades, led = Hearts)", () => {
  const trump = Suit.Spades;
  const led = Suit.Hearts;
  const right = c(CardName.Jack, Suit.Spades);
  const left = c(CardName.Jack, Suit.Clubs);
  const trumpAce = c(CardName.Ace, Suit.Spades);
  const trumpNine = c(CardName.Nine, Suit.Spades);
  const ledAce = c(CardName.Ace, Suit.Hearts);
  const offAce = c(CardName.Ace, Suit.Diamonds);

  test("right > left > trump ace > trump nine", () => {
    expect(cardStrength(right, trump, led)).toBeGreaterThan(
      cardStrength(left, trump, led),
    );
    expect(cardStrength(left, trump, led)).toBeGreaterThan(
      cardStrength(trumpAce, trump, led),
    );
    expect(cardStrength(trumpAce, trump, led)).toBeGreaterThan(
      cardStrength(trumpNine, trump, led),
    );
  });

  test("any trump beats the highest card of the led suit", () => {
    expect(cardStrength(trumpNine, trump, led)).toBeGreaterThan(
      cardStrength(ledAce, trump, led),
    );
  });

  test("a card off both trump and led suit cannot win", () => {
    expect(cardStrength(offAce, trump, led)).toBe(0);
  });

  test("led-suit ace beats led-suit king", () => {
    const ledKing = c(CardName.King, Suit.Hearts);
    expect(cardStrength(ledAce, trump, led)).toBeGreaterThan(
      cardStrength(ledKing, trump, led),
    );
  });
});
