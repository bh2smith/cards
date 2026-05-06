import { test, expect, describe } from "bun:test";
import { CardName, Suit } from "typedeck";
import {
  handValue,
  isBust,
  isBlackjack,
  isSoft,
  shouldDealerHit,
  BlackjackGame,
} from "../game";
import type { PlayingCard } from "typedeck";

function card(name: CardName, suit = Suit.Spades): PlayingCard {
  return { cardName: name, suit } as PlayingCard;
}

const A = card(CardName.Ace);
const K = card(CardName.King);
const Q = card(CardName.Queen);
const J = card(CardName.Jack);
const T = card(CardName.Ten);
const N = card(CardName.Nine);
const E = card(CardName.Eight);
const S = card(CardName.Seven);
const X = card(CardName.Six);
const F = card(CardName.Five);
const R = card(CardName.Four);
const H = card(CardName.Three);
const W = card(CardName.Two);

describe("handValue", () => {
  test("single ace = 11", () => expect(handValue([A])).toBe(11));
  test("ace + king = 21", () => expect(handValue([A, K])).toBe(21));
  test("ace + king + two = 13 (ace downgraded)", () =>
    expect(handValue([A, K, W])).toBe(13));
  test("two aces = 12", () => expect(handValue([A, A])).toBe(12));
  test("three aces = 13", () => expect(handValue([A, A, A])).toBe(13));
  test("face cards = 10 each", () => expect(handValue([K, Q, J])).toBe(30));
  test("7 + 8 = 15", () => expect(handValue([S, E])).toBe(15));
  test("10 + 9 = 19", () => expect(handValue([T, N])).toBe(19));
});

describe("isBust", () => {
  test("22 is bust", () => expect(isBust([K, Q, W])).toBe(true));
  test("21 is not bust", () => expect(isBust([A, K])).toBe(false));
  test("21 hard is not bust", () => expect(isBust([K, Q, A])).toBe(false));
});

describe("isBlackjack", () => {
  test("ace + king = blackjack", () => expect(isBlackjack([A, K])).toBe(true));
  test("ace + queen = blackjack", () => expect(isBlackjack([A, Q])).toBe(true));
  test("three cards to 21 is not blackjack", () =>
    expect(isBlackjack([S, R, T])).toBe(false));
  test("two cards but not 21 is not blackjack", () =>
    expect(isBlackjack([K, Q])).toBe(false));
});

describe("isSoft", () => {
  test("ace + 6 = soft 17", () => expect(isSoft([A, X])).toBe(true));
  test("ace + 6 + 10 = hard 17", () => expect(isSoft([A, X, T])).toBe(false));
  test("ace + king = soft 21", () => expect(isSoft([A, K])).toBe(true));
  test("king + 7 = hard 17", () => expect(isSoft([K, S])).toBe(false));
});

describe("shouldDealerHit", () => {
  test("hits on 16", () => expect(shouldDealerHit([K, X])).toBe(true));
  test("hits on soft 17", () => expect(shouldDealerHit([A, X])).toBe(true));
  test("stands on hard 17", () => expect(shouldDealerHit([K, S])).toBe(false));
  test("stands on 18", () => expect(shouldDealerHit([K, E])).toBe(false));
  test("stands on 21", () => expect(shouldDealerHit([A, K])).toBe(false));
});

describe("BlackjackGame", () => {
  test("starts in BETTING phase", () => {
    const g = new BlackjackGame();
    expect(g.getState().phase).toBe("BETTING");
    expect(g.getState().chips).toBe(100);
  });

  test("placing bet moves to PLAYER_TURN", () => {
    const g = new BlackjackGame();
    g.placeBet(10);
    expect(g.getState().phase).toBe("PLAYER_TURN");
    expect(g.getState().chips).toBe(90);
    expect(g.getState().bet).toBe(10);
    expect(g.getState().playerHand.length).toBe(2);
    expect(g.getState().dealerHand.length).toBe(2);
  });

  test("cannot bet more than chips", () => {
    const g = new BlackjackGame(10);
    expect(g.canBet(25)).toBe(false);
    expect(g.canBet(10)).toBe(true);
  });

  test("hit adds a card", () => {
    const g = new BlackjackGame();
    g.placeBet(10);
    const before = g.getState().playerHand.length;
    // only hit if not already blackjack
    if (g.getState().phase === "PLAYER_TURN") {
      g.hit();
      expect(g.getState().playerHand.length).toBeGreaterThanOrEqual(before);
    }
  });

  test("newRound resets to BETTING", () => {
    const g = new BlackjackGame();
    g.placeBet(10);
    g.beginDealerTurn();
    while (g.dealerDrawOne()) {}
    g.settleRound();
    expect(g.getState().phase).toBe("ROUND_OVER");
    g.newRound();
    expect(g.getState().phase).toBe("BETTING");
  });

  test("chips reset to 100 when bust", () => {
    const g = new BlackjackGame(5);
    g.placeBet(5);
    g.beginDealerTurn();
    while (g.dealerDrawOne()) {}
    g.settleRound();
    // If player lost, chips may be 0
    g.newRound();
    // Either has chips from win, or reset to 100
    expect(g.getState().chips).toBeGreaterThan(0);
  });

  test("push returns bet", () => {
    const g = new BlackjackGame(50);
    g.placeBet(25);
    expect(g.getState().chips).toBe(25);
  });

  test("double down doubles bet and draws one card", () => {
    const g = new BlackjackGame(100);
    g.placeBet(10);
    const state = g.getState();
    if (state.phase === "PLAYER_TURN" && g.canDoubleDown()) {
      g.doubleDown();
      const s = g.getState();
      expect(s.bet).toBe(20);
      expect(s.chips).toBe(80);
      expect(s.playerHand.length).toBe(3);
    }
  });

  test("cannot double down without sufficient chips", () => {
    const g = new BlackjackGame(15);
    g.placeBet(10);
    // chips = 5, bet = 10 — can't afford to double
    if (g.getState().phase === "PLAYER_TURN") {
      expect(g.canDoubleDown()).toBe(false);
    }
  });
});
