import { test, expect, describe } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import { createDeck } from "../../../shared/deck";
import { resolvePreset } from "../../../shared/engine/variant";
import { RUMMY_FAMILY } from "../config";
import { botChooseDiscard, botChooseDraw, botShouldKnock } from "../ai";

const DECK = createDeck();
const card = (name: CardName, suit: Suit): PlayingCard =>
  DECK.find((c) => c.cardName === name && c.suit === suit)!;

const straight = resolvePreset(RUMMY_FAMILY, undefined);
const rum500 = resolvePreset(RUMMY_FAMILY, "500-rum");

describe("botChooseDraw", () => {
  test("takes the top discard when it completes a meld", () => {
    const hand = [
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
      card(CardName.Nine, Suit.Clubs),
      card(CardName.Two, Suit.Spades),
    ];
    const pile = [card(CardName.Seven, Suit.Spades)];
    expect(botChooseDraw(hand, pile, straight)).toEqual({
      source: "discard",
      depth: 0,
    });
  });

  test("draws from stock when the top discard is useless", () => {
    const hand = [
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
      card(CardName.Nine, Suit.Clubs),
    ];
    const pile = [card(CardName.King, Suit.Spades)];
    expect(botChooseDraw(hand, pile, straight)).toEqual({ source: "stock" });
  });

  test("500 rum: digs deep only when the meld pays for the extra cards", () => {
    const hand = [
      card(CardName.King, Suit.Hearts),
      card(CardName.King, Suit.Diamonds),
      card(CardName.Four, Suit.Clubs),
    ];
    // K♠ buried under two junk cards: meld K-K-K worth 30 ≥ 2 × 5.
    const worthIt = [
      card(CardName.King, Suit.Spades),
      card(CardName.Two, Suit.Hearts),
      card(CardName.Six, Suit.Spades),
    ];
    expect(botChooseDraw(hand, worthIt, rum500)).toEqual({
      source: "discard",
      depth: 0,
    });

    // A low meld buried under many cards is not worth the haul.
    const lowHand = [
      card(CardName.Two, Suit.Clubs),
      card(CardName.Two, Suit.Diamonds),
      card(CardName.Nine, Suit.Hearts),
    ];
    const notWorthIt = [
      card(CardName.Two, Suit.Spades), // meld 2-2-2 worth 6 < 3 × 5
      card(CardName.Six, Suit.Spades),
      card(CardName.Jack, Suit.Clubs),
      card(CardName.Eight, Suit.Diamonds),
    ];
    const choice = botChooseDraw(lowHand, notWorthIt, rum500);
    expect(choice).not.toEqual({ source: "discard", depth: 0 });
  });
});

describe("botChooseDiscard", () => {
  test("keeps meld cards and dumps the highest loose card", () => {
    const hand = [
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
      card(CardName.Seven, Suit.Spades),
      card(CardName.King, Suit.Clubs),
      card(CardName.Three, Suit.Diamonds),
    ];
    const idx = botChooseDiscard(hand, straight, []);
    expect(hand[idx]!.cardName).toBe(CardName.King);
  });

  test("avoids feeding the opponent's discard pickups", () => {
    // K♣ and Q♥ shed the same deadwood (10), but the opponent picked up a king.
    const hand = [
      card(CardName.King, Suit.Clubs),
      card(CardName.Queen, Suit.Hearts),
      card(CardName.Two, Suit.Diamonds),
      card(CardName.Five, Suit.Spades),
      card(CardName.Seven, Suit.Clubs),
    ];
    const oppPickups = [card(CardName.King, Suit.Diamonds)];
    const idx = botChooseDiscard(hand, straight, oppPickups);
    expect(hand[idx]!.cardName).toBe(CardName.Queen);
  });
});

describe("botShouldKnock", () => {
  test("knocks at ten or below", () => {
    expect(botShouldKnock(10)).toBe(true);
    expect(botShouldKnock(0)).toBe(true);
    expect(botShouldKnock(11)).toBe(false);
  });
});
