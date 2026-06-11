import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { legalPlays, trickWinner } from "../trick";
import type { PlayerIndex, Trick } from "../types";

function c(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

describe("legalPlays — following with bowers", () => {
  test("leading allows any card", () => {
    const hand = [c(CardName.Nine, Suit.Spades), c(CardName.Ace, Suit.Hearts)];
    expect(legalPlays(hand, null, Suit.Spades)).toEqual(hand);
    expect(
      legalPlays(hand, { leader: 0, plays: [], winner: null }, Suit.Spades),
    ).toEqual(hand);
  });

  test("must follow the led suit; bowers count as trump only", () => {
    const trump = Suit.Spades;
    const hand = [
      c(CardName.King, Suit.Hearts),
      c(CardName.Nine, Suit.Spades),
      c(CardName.Jack, Suit.Clubs), // left bower → trump, not a heart
    ];
    const trick: Trick = {
      leader: 0,
      plays: [{ player: 0, card: c(CardName.Ten, Suit.Hearts) }],
      winner: null,
    };
    // Led hearts: only the actual heart is legal.
    expect(legalPlays(hand, trick, trump)).toEqual([
      c(CardName.King, Suit.Hearts),
    ]);
  });

  test("left bower does NOT satisfy following its printed suit", () => {
    const trump = Suit.Hearts; // left bower = J♦
    const hand = [
      c(CardName.Jack, Suit.Diamonds), // trump (left bower)
      c(CardName.Nine, Suit.Diamonds), // a real diamond
    ];
    const trick: Trick = {
      leader: 0,
      plays: [{ player: 0, card: c(CardName.Ace, Suit.Diamonds) }],
      winner: null,
    };
    // Diamonds led: only the real diamond follows (the left bower is trump).
    expect(legalPlays(hand, trick, trump)).toEqual([
      c(CardName.Nine, Suit.Diamonds),
    ]);
  });

  test("left bower DOES satisfy following trump", () => {
    const trump = Suit.Hearts; // left bower = J♦
    const hand = [
      c(CardName.Jack, Suit.Diamonds), // left bower (trump)
      c(CardName.Nine, Suit.Spades),
    ];
    const trick: Trick = {
      leader: 0,
      plays: [{ player: 0, card: c(CardName.King, Suit.Hearts) }],
      winner: null,
    };
    expect(legalPlays(hand, trick, trump)).toEqual([
      c(CardName.Jack, Suit.Diamonds),
    ]);
  });

  test("void in led suit allows any card", () => {
    const trump = Suit.Spades;
    const hand = [c(CardName.Ace, Suit.Hearts), c(CardName.Nine, Suit.Spades)];
    const trick: Trick = {
      leader: 0,
      plays: [{ player: 0, card: c(CardName.Ace, Suit.Clubs) }],
      winner: null,
    };
    expect(legalPlays(hand, trick, trump)).toEqual(hand);
  });
});

describe("trickWinner — trump aware", () => {
  test("trump beats the led suit", () => {
    const trick: Trick = {
      leader: 0,
      winner: null,
      plays: [
        { player: 0, card: c(CardName.Ace, Suit.Hearts) }, // led hearts
        { player: 1, card: c(CardName.King, Suit.Hearts) },
        { player: 2, card: c(CardName.Nine, Suit.Spades) }, // trump
        { player: 3, card: c(CardName.Ace, Suit.Diamonds) },
      ],
    };
    expect(trickWinner(trick, Suit.Spades)).toBe(2 as PlayerIndex);
  });

  test("right bower beats left bower beats trump ace", () => {
    const trick: Trick = {
      leader: 0,
      winner: null,
      plays: [
        { player: 0, card: c(CardName.Ace, Suit.Spades) }, // trump ace
        { player: 1, card: c(CardName.Jack, Suit.Clubs) }, // left bower
        { player: 2, card: c(CardName.Jack, Suit.Spades) }, // right bower
        { player: 3, card: c(CardName.King, Suit.Spades) },
      ],
    };
    expect(trickWinner(trick, Suit.Spades)).toBe(2 as PlayerIndex);
  });

  test("left bower (played by void player) beats the led-suit ace", () => {
    const trick: Trick = {
      leader: 0,
      winner: null,
      plays: [
        { player: 0, card: c(CardName.Ace, Suit.Diamonds) }, // led diamonds
        { player: 1, card: c(CardName.Jack, Suit.Clubs) }, // left bower, trump=spades
        { player: 2, card: c(CardName.King, Suit.Diamonds) },
        { player: 3, card: c(CardName.Nine, Suit.Diamonds) },
      ],
    };
    expect(trickWinner(trick, Suit.Spades)).toBe(1 as PlayerIndex);
  });

  test("highest of led suit wins when no trump played", () => {
    const trick: Trick = {
      leader: 0,
      winner: null,
      plays: [
        { player: 0, card: c(CardName.Ten, Suit.Hearts) },
        { player: 1, card: c(CardName.Ace, Suit.Hearts) },
        { player: 2, card: c(CardName.Ace, Suit.Clubs) }, // off-suit, can't win
        { player: 3, card: c(CardName.King, Suit.Hearts) },
      ],
    };
    expect(trickWinner(trick, Suit.Spades)).toBe(1 as PlayerIndex);
  });

  test("leading the left bower makes trump the led suit", () => {
    const trick: Trick = {
      leader: 0,
      winner: null,
      plays: [
        { player: 0, card: c(CardName.Jack, Suit.Diamonds) }, // left bower, trump hearts
        { player: 1, card: c(CardName.Ace, Suit.Diamonds) }, // a real diamond — off trump
        { player: 2, card: c(CardName.Nine, Suit.Hearts) }, // trump
        { player: 3, card: c(CardName.King, Suit.Diamonds) },
      ],
    };
    // Trump (hearts) was led; the diamonds are off-suit and cannot win.
    expect(trickWinner(trick, Suit.Hearts)).toBe(0 as PlayerIndex);
  });
});
