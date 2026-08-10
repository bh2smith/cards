import { test, expect, describe, beforeEach } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import {
  RedDogGame,
  rankHigh,
  spreadOf,
  payoutForSpread,
  PAIR_PAYOUT,
} from "../game";
import { balance, betOptions } from "../../../shared/engine/betting";
import { resetBankrollForTests } from "../../../shared/engine/bankroll";
import { cardKey, seededRng } from "../../../shared/deck";

function card(name: CardName, suit = Suit.Spades): PlayingCard {
  return { cardName: name, suit } as PlayingCard;
}

beforeEach(() => {
  resetBankrollForTests();
});

describe("rank helpers", () => {
  test("aces are high", () => expect(rankHigh(card(CardName.Ace))).toBe(14));
  test("king is 13", () => expect(rankHigh(card(CardName.King))).toBe(13));
  test("two is 2", () => expect(rankHigh(card(CardName.Two))).toBe(2));
  test("spread of 4 and 8 is 3", () =>
    expect(spreadOf(card(CardName.Four), card(CardName.Eight))).toBe(3));
  test("payout tiers", () => {
    expect(payoutForSpread(1)).toBe(5);
    expect(payoutForSpread(2)).toBe(4);
    expect(payoutForSpread(3)).toBe(2);
    expect(payoutForSpread(4)).toBe(1);
    expect(payoutForSpread(11)).toBe(1);
  });
});

describe("RedDogGame rounds", () => {
  test("consecutive cards push and return the stake", () => {
    const g = new RedDogGame(1, [
      card(CardName.Five),
      card(CardName.Six, Suit.Hearts),
    ]);
    expect(g.placeBet(10)).toBe(true);
    const s = g.getState();
    expect(s.phase).toBe("RESULT");
    expect(s.outcome).toBe("push");
    expect(balance()).toBe(200);
  });

  test("king-ace is consecutive (aces high)", () => {
    const g = new RedDogGame(1, [
      card(CardName.King),
      card(CardName.Ace, Suit.Hearts),
    ]);
    g.placeBet(10);
    expect(g.getState().outcome).toBe("push");
    expect(balance()).toBe(200);
  });

  test("pair with matching third card pays 11:1", () => {
    const g = new RedDogGame(1, [
      card(CardName.Seven),
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
    ]);
    g.placeBet(10);
    const s = g.getState();
    expect(s.phase).toBe("RESULT");
    expect(s.outcome).toBe("win");
    expect(s.payoutRatio).toBe(PAIR_PAYOUT);
    expect(balance()).toBe(200 + 10 * PAIR_PAYOUT);
  });

  test("pair without match pushes", () => {
    const g = new RedDogGame(1, [
      card(CardName.Seven),
      card(CardName.Seven, Suit.Hearts),
      card(CardName.King),
    ]);
    g.placeBet(10);
    expect(g.getState().outcome).toBe("push");
    expect(balance()).toBe(200);
  });

  const tiers: Array<{
    hi: CardName;
    third: CardName;
    spread: number;
    ratio: number;
  }> = [
    { hi: CardName.Four, third: CardName.Three, spread: 1, ratio: 5 },
    { hi: CardName.Five, third: CardName.Three, spread: 2, ratio: 4 },
    { hi: CardName.Six, third: CardName.Four, spread: 3, ratio: 2 },
    { hi: CardName.Ten, third: CardName.Five, spread: 7, ratio: 1 },
  ];
  for (const { hi, third, spread, ratio } of tiers) {
    test(`spread ${spread} pays ${ratio}:1`, () => {
      const g = new RedDogGame(1, [
        card(CardName.Two),
        card(hi, Suit.Hearts),
        card(third, Suit.Diamonds),
      ]);
      g.placeBet(10);
      const raiseState = g.getState();
      expect(raiseState.phase).toBe("RAISE");
      expect(raiseState.spread).toBe(spread);
      expect(raiseState.payoutRatio).toBe(ratio);
      expect(balance()).toBe(190);
      g.call();
      const s = g.getState();
      expect(s.outcome).toBe("win");
      expect(balance()).toBe(200 + 10 * ratio);
    });
  }

  test("third card outside the spread loses the stake", () => {
    const g = new RedDogGame(1, [
      card(CardName.Two),
      card(CardName.Six, Suit.Hearts),
      card(CardName.King),
    ]);
    g.placeBet(10);
    g.call();
    expect(g.getState().outcome).toBe("lose");
    expect(balance()).toBe(190);
  });

  test("boundary card counts as outside", () => {
    const g = new RedDogGame(1, [
      card(CardName.Two),
      card(CardName.Six, Suit.Hearts),
      card(CardName.Six, Suit.Diamonds),
    ]);
    g.placeBet(10);
    g.call();
    expect(g.getState().outcome).toBe("lose");
  });

  test("raise doubles the stake and the win", () => {
    const g = new RedDogGame(1, [
      card(CardName.Two),
      card(CardName.Six, Suit.Hearts),
      card(CardName.Four, Suit.Diamonds),
    ]);
    g.placeBet(10);
    expect(g.canRaise()).toBe(true);
    expect(g.raise()).toBe(true);
    const s = g.getState();
    expect(s.bet).toBe(20);
    expect(s.raised).toBe(true);
    expect(s.outcome).toBe("win"); // spread 3, pays 2:1 on 20
    expect(balance()).toBe(200 + 20 * 2);
  });

  test("raise doubles the loss", () => {
    const g = new RedDogGame(1, [
      card(CardName.Two),
      card(CardName.Six, Suit.Hearts),
      card(CardName.King),
    ]);
    g.placeBet(10);
    g.raise();
    expect(g.getState().outcome).toBe("lose");
    expect(balance()).toBe(180);
  });

  test("bet is rejected when it exceeds the balance", () => {
    const g = new RedDogGame(1);
    expect(g.canBet(500)).toBe(false);
    expect(g.placeBet(500)).toBe(false);
    expect(g.getState().phase).toBe("BETTING");
    expect(balance()).toBe(200);
  });

  test("newRound only works from RESULT and resets the table", () => {
    const g = new RedDogGame(1, [
      card(CardName.Two),
      card(CardName.Six, Suit.Hearts),
      card(CardName.Four, Suit.Diamonds),
    ]);
    g.placeBet(10);
    g.newRound(); // no-op mid-round
    expect(g.getState().phase).toBe("RAISE");
    g.call();
    g.newRound();
    const s = g.getState();
    expect(s.phase).toBe("BETTING");
    expect(s.card1).toBeNull();
    expect(s.bet).toBe(0);
  });
});

describe("seeded soak", () => {
  test("100 rounds keep the balance non-negative and conserve the deck", () => {
    const rng = seededRng(42);
    const g = new RedDogGame(7);
    for (let i = 0; i < 100; i++) {
      const options = betOptions(balance());
      if (options.length === 0) break;
      const amount = options[Math.floor(rng() * options.length)]!;
      expect(g.placeBet(amount)).toBe(true);
      if (g.getState().phase === "RAISE") {
        if (rng() < 0.5 && g.canRaise()) g.raise();
        else g.call();
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
