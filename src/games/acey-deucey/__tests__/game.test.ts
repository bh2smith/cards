import { test, expect, describe, beforeEach } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import { AceyDeuceyGame, rankHigh, valueLabel } from "../game";
import { balance, betOptions } from "../../../shared/engine/betting";
import {
  resetBankrollForTests,
  adjustBankroll,
  getBankroll,
} from "../../../shared/engine/bankroll";
import { cardKey, seededRng } from "../../../shared/deck";

function card(name: CardName, suit = Suit.Spades): PlayingCard {
  return { cardName: name, suit } as PlayingCard;
}

beforeEach(() => {
  resetBankrollForTests();
});

describe("helpers", () => {
  test("aces high by default", () =>
    expect(rankHigh(card(CardName.Ace))).toBe(14));
  test("value labels", () => {
    expect(valueLabel(14)).toBe("A");
    expect(valueLabel(1)).toBe("A");
    expect(valueLabel(11)).toBe("J");
    expect(valueLabel(7)).toBe("7");
  });
});

describe("ace calling", () => {
  const deck = [
    card(CardName.Ace),
    card(CardName.Nine, Suit.Hearts),
    card(CardName.Five, Suit.Diamonds),
  ];

  test("first-card ace waits for a call", () => {
    const g = new AceyDeuceyGame(1, deck);
    g.deal();
    expect(g.getState().phase).toBe("CALL_ACE");
    expect(g.getState().card2).toBeNull();
  });

  test("called high: bracket 9..A, third card 5 loses", () => {
    const g = new AceyDeuceyGame(1, deck);
    g.deal();
    g.callAce("high");
    const s = g.getState();
    expect(s.phase).toBe("BETTING");
    expect(s.lo).toBe(9);
    expect(s.hi).toBe(14);
    g.bet(10);
    expect(g.getState().outcome).toBe("lose");
    expect(balance()).toBe(190);
  });

  test("called low: bracket A..9, third card 5 wins", () => {
    const g = new AceyDeuceyGame(1, deck);
    g.deal();
    g.callAce("low");
    const s = g.getState();
    expect(s.lo).toBe(1);
    expect(s.hi).toBe(9);
    g.bet(10);
    expect(g.getState().outcome).toBe("win");
    expect(balance()).toBe(210);
  });

  test("second-card ace is always high", () => {
    const g = new AceyDeuceyGame(1, [
      card(CardName.Five),
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Ten, Suit.Diamonds),
    ]);
    g.deal();
    const s = g.getState();
    expect(s.phase).toBe("BETTING");
    expect(s.lo).toBe(5);
    expect(s.hi).toBe(14);
  });
});

describe("pushes", () => {
  test("equal ranks push with no bet at risk", () => {
    const g = new AceyDeuceyGame(1, [
      card(CardName.Eight),
      card(CardName.Eight, Suit.Hearts),
    ]);
    g.deal();
    const s = g.getState();
    expect(s.phase).toBe("RESULT");
    expect(s.outcome).toBe("push");
    expect(balance()).toBe(200);
  });

  test("consecutive ranks push", () => {
    const g = new AceyDeuceyGame(1, [
      card(CardName.Eight),
      card(CardName.Nine, Suit.Hearts),
    ]);
    g.deal();
    expect(g.getState().outcome).toBe("push");
    expect(balance()).toBe(200);
  });

  test("two aces push regardless of the call", () => {
    const g = new AceyDeuceyGame(1, [
      card(CardName.Ace),
      card(CardName.Ace, Suit.Hearts),
    ]);
    g.deal();
    g.callAce("low");
    expect(g.getState().outcome).toBe("push");
  });
});

describe("resolution", () => {
  test("third card in between wins 1:1", () => {
    const g = new AceyDeuceyGame(1, [
      card(CardName.Two),
      card(CardName.King, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
    ]);
    g.deal();
    g.bet(10);
    expect(g.getState().outcome).toBe("win");
    expect(balance()).toBe(210);
  });

  test("third card outside loses the bet", () => {
    const g = new AceyDeuceyGame(1, [
      card(CardName.Five),
      card(CardName.Nine, Suit.Hearts),
      card(CardName.King, Suit.Diamonds),
    ]);
    g.deal();
    g.bet(10);
    expect(g.getState().outcome).toBe("lose");
    expect(balance()).toBe(190);
  });

  test("hitting the post loses double", () => {
    const g = new AceyDeuceyGame(1, [
      card(CardName.Five),
      card(CardName.Nine, Suit.Hearts),
      card(CardName.Nine, Suit.Diamonds),
    ]);
    g.deal();
    g.bet(10);
    const s = g.getState();
    expect(s.outcome).toBe("post");
    expect(s.lost).toBe(20);
    expect(balance()).toBe(180);
  });

  test("post double-loss is capped at the remaining balance", () => {
    // Burn the daily top-up, then drop the bankroll to 15.
    adjustBankroll(-150);
    getBankroll(); // triggers the once-a-day top-up back to 100
    adjustBankroll(-85);
    expect(balance()).toBe(15);

    const g = new AceyDeuceyGame(1, [
      card(CardName.Five),
      card(CardName.Nine, Suit.Hearts),
      card(CardName.Nine, Suit.Diamonds),
    ]);
    g.deal();
    g.bet(10); // stake 10 leaves 5; post can only take 5 more
    const s = g.getState();
    expect(s.outcome).toBe("post");
    expect(s.lost).toBe(15);
    expect(balance()).toBe(0);
  });
});

describe("betting gate", () => {
  test("bets are rejected before the bracket is shown", () => {
    const g = new AceyDeuceyGame(1, [
      card(CardName.Two),
      card(CardName.King, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
    ]);
    expect(g.bet(10)).toBe(false);
    expect(balance()).toBe(200);
    g.deal();
    expect(g.getState().phase).toBe("BETTING");
    expect(balance()).toBe(200); // nothing staked until the player bets
    expect(g.bet(10)).toBe(true);
  });

  test("bets are rejected while calling an ace", () => {
    const g = new AceyDeuceyGame(1, [
      card(CardName.Ace),
      card(CardName.Nine, Suit.Hearts),
      card(CardName.Five, Suit.Diamonds),
    ]);
    g.deal();
    expect(g.bet(10)).toBe(false);
    expect(balance()).toBe(200);
  });

  test("bet cannot exceed the balance", () => {
    const g = new AceyDeuceyGame(1, [
      card(CardName.Two),
      card(CardName.King, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
    ]);
    g.deal();
    expect(g.canBet(500)).toBe(false);
    expect(g.bet(500)).toBe(false);
    expect(g.getState().phase).toBe("BETTING");
  });
});

describe("seeded soak", () => {
  test("100 rounds keep the balance non-negative and conserve the deck", () => {
    const rng = seededRng(99);
    const g = new AceyDeuceyGame(11);
    for (let i = 0; i < 100; i++) {
      g.deal();
      if (g.getState().phase === "CALL_ACE") {
        g.callAce(rng() < 0.5 ? "high" : "low");
      }
      if (g.getState().phase === "BETTING") {
        const options = betOptions(balance());
        if (options.length === 0) break;
        const amount = options[Math.floor(rng() * options.length)]!;
        expect(g.bet(amount)).toBe(true);
      }
      const s = g.getState();
      expect(s.phase).toBe("RESULT");
      expect(balance()).toBeGreaterThanOrEqual(0);
      const dealt = [s.card1, s.card2, s.card3].filter(
        (c): c is NonNullable<typeof c> => c !== null,
      );
      const keys = new Set(dealt.map((c) => cardKey(c)));
      expect(keys.size).toBe(dealt.length);
      expect(g.deckCount()).toBe(52 - dealt.length);
      g.newRound();
    }
  });
});
