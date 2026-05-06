import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { botChooseDraw, botChooseDiscard, botShouldKnock } from "../ai";

function card(rank: CardName, suit: Suit = Suit.Spades): PlayingCard {
  return new PlayingCard(rank, suit);
}

describe("botChooseDraw", () => {
  test("takes discard when it improves hand", () => {
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Four, Suit.Hearts),
      card(CardName.King, Suit.Spades),
      card(CardName.Queen, Suit.Clubs),
      card(CardName.Jack, Suit.Diamonds),
      card(CardName.Nine, Suit.Hearts),
      card(CardName.Eight, Suit.Clubs),
      card(CardName.Seven, Suit.Spades),
      card(CardName.Six, Suit.Diamonds),
      card(CardName.Two, Suit.Clubs),
    ];
    // 5 of hearts completes a run
    const discardTop = card(CardName.Five, Suit.Hearts);
    expect(botChooseDraw(hand, discardTop)).toBe("discard");
  });

  test("draws from stock when discard does not help", () => {
    // Hand with two melds and low deadwood — no room to improve
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Four, Suit.Hearts),
      card(CardName.Five, Suit.Hearts),
      card(CardName.King, Suit.Spades),
      card(CardName.King, Suit.Hearts),
      card(CardName.King, Suit.Clubs),
      card(CardName.Ace, Suit.Diamonds),
      card(CardName.Two, Suit.Diamonds),
      card(CardName.Three, Suit.Diamonds),
      card(CardName.Ace, Suit.Clubs),
    ];
    // Queen of Clubs — high card that doesn't form any meld with this hand
    const discardTop = card(CardName.Queen, Suit.Clubs);
    expect(botChooseDraw(hand, discardTop)).toBe("stock");
  });
});

describe("botChooseDiscard", () => {
  test("discards card that minimizes remaining deadwood", () => {
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Four, Suit.Hearts),
      card(CardName.Five, Suit.Hearts),
      card(CardName.King, Suit.Spades),
      card(CardName.Ace, Suit.Clubs),
    ];
    // The King (10 points) should be discarded since the run covers 3-4-5
    const idx = botChooseDiscard(hand);
    expect(hand[idx]!.cardName).toBe(CardName.King);
  });
});

describe("botShouldKnock", () => {
  test("knocks when deadwood is low", () => {
    const hand = [
      card(CardName.Three, Suit.Hearts),
      card(CardName.Four, Suit.Hearts),
      card(CardName.Five, Suit.Hearts),
      card(CardName.King, Suit.Spades),
      card(CardName.King, Suit.Hearts),
      card(CardName.King, Suit.Clubs),
      card(CardName.Ace, Suit.Diamonds),
      card(CardName.Two, Suit.Diamonds),
      card(CardName.Three, Suit.Diamonds),
      card(CardName.Four, Suit.Diamonds),
    ];
    // melds cover 3-4-5H, K-K-K, A-2-3-4D → deadwood = 0
    expect(botShouldKnock(hand)).toBe(true);
  });

  test("does not knock with high deadwood", () => {
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
    expect(botShouldKnock(hand)).toBe(false);
  });
});
