import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import {
  canFollow,
  canLead,
  legalPlays,
  trickPoints,
  trickWinner,
} from "../trick";
import type { PlayerIndex, Trick } from "../types";

function c(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

const C2 = c(CardName.Two, Suit.Clubs);
const C5 = c(CardName.Five, Suit.Clubs);
const CK = c(CardName.King, Suit.Clubs);
const D3 = c(CardName.Three, Suit.Diamonds);
const D9 = c(CardName.Nine, Suit.Diamonds);
const SQ = c(CardName.Queen, Suit.Spades);
const SA = c(CardName.Ace, Suit.Spades);
const H4 = c(CardName.Four, Suit.Hearts);
const HK = c(CardName.King, Suit.Hearts);
const HA = c(CardName.Ace, Suit.Hearts);

describe("canLead", () => {
  test("first trick of round: only 2♣ may be led", () => {
    const hand = [C2, D3, H4, SA];
    expect(canLead(C2, hand, false, true)).toBe(true);
    expect(canLead(D3, hand, false, true)).toBe(false);
    expect(canLead(H4, hand, false, true)).toBe(false);
  });

  test("hearts cannot be led until broken", () => {
    const hand = [D3, H4, SA];
    expect(canLead(H4, hand, false, false)).toBe(false);
    expect(canLead(D3, hand, false, false)).toBe(true);
  });

  test("hearts may be led once broken", () => {
    const hand = [D3, H4];
    expect(canLead(H4, hand, true, false)).toBe(true);
  });

  test("hearts may be led if only hearts remain even when not broken", () => {
    const hand = [H4, HK, HA];
    expect(canLead(H4, hand, false, false)).toBe(true);
  });
});

describe("canFollow", () => {
  test("must follow led suit if able", () => {
    const hand = [C5, CK, D3];
    expect(canFollow(C5, Suit.Clubs, hand, false)).toBe(true);
    expect(canFollow(D3, Suit.Clubs, hand, false)).toBe(false);
  });

  test("any card may be played when void in led suit", () => {
    const hand = [D3, H4, SA];
    expect(canFollow(SA, Suit.Clubs, hand, false)).toBe(true);
    expect(canFollow(H4, Suit.Clubs, hand, false)).toBe(true);
  });

  test("first trick: cannot dump points unless only points remain", () => {
    const hand = [D3, H4, SQ];
    expect(canFollow(H4, Suit.Clubs, hand, true)).toBe(false);
    expect(canFollow(SQ, Suit.Clubs, hand, true)).toBe(false);
    expect(canFollow(D3, Suit.Clubs, hand, true)).toBe(true);
  });

  test("first trick: may dump points if only points remain", () => {
    const hand = [H4, SQ];
    expect(canFollow(H4, Suit.Clubs, hand, true)).toBe(true);
    expect(canFollow(SQ, Suit.Clubs, hand, true)).toBe(true);
  });
});

describe("legalPlays", () => {
  test("leading after hearts broken includes hearts", () => {
    const hand = [D3, H4, SA];
    const result = legalPlays(
      hand,
      { leader: 0, ledSuit: null, plays: [] },
      true,
      false,
    );
    expect(result).toEqual(hand);
  });

  test("following with one matching card returns only that card", () => {
    const hand = [C5, D3, H4];
    const trick: Trick = {
      leader: 0,
      ledSuit: Suit.Clubs,
      plays: [{ player: 0, card: C2 }],
    };
    const result = legalPlays(hand, trick, false, false);
    expect(result).toEqual([C5]);
  });
});

describe("trickWinner", () => {
  test("highest card in led suit wins", () => {
    const trick: Trick = {
      leader: 0,
      ledSuit: Suit.Clubs,
      plays: [
        { player: 0, card: C2 },
        { player: 1, card: C5 },
        { player: 2, card: H4 },
        { player: 3, card: CK },
      ],
    };
    expect(trickWinner(trick)).toBe(3 as PlayerIndex);
  });

  test("off-suit cards never win even if higher rank", () => {
    const trick: Trick = {
      leader: 0,
      ledSuit: Suit.Diamonds,
      plays: [
        { player: 0, card: D3 },
        { player: 1, card: SA },
        { player: 2, card: HA },
        { player: 3, card: D9 },
      ],
    };
    expect(trickWinner(trick)).toBe(3 as PlayerIndex);
  });

  test("Ace beats King in led suit (Ace high)", () => {
    const trick: Trick = {
      leader: 0,
      ledSuit: Suit.Hearts,
      plays: [
        { player: 0, card: HK },
        { player: 1, card: HA },
        { player: 2, card: H4 },
        { player: 3, card: c(CardName.Two, Suit.Hearts) },
      ],
    };
    expect(trickWinner(trick)).toBe(1 as PlayerIndex);
  });
});

describe("trickPoints", () => {
  test("hearts and Q♠ count", () => {
    const trick: Trick = {
      leader: 0,
      ledSuit: Suit.Hearts,
      plays: [
        { player: 0, card: H4 },
        { player: 1, card: HA },
        { player: 2, card: SQ },
        { player: 3, card: D3 },
      ],
    };
    expect(trickPoints(trick)).toBe(1 + 1 + 13);
  });
});
