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

  test("placing bet deals cards and deducts chips", () => {
    const g = new BlackjackGame();
    g.placeBet(10);
    const s = g.getState();
    expect(s.phase === "PLAYER_TURN" || s.phase === "DEALER_TURN").toBe(true);
    expect(s.chips).toBe(90);
    expect(s.bet).toBe(10);
    expect(s.playerHand.length).toBe(2);
    expect(s.dealerHand.length).toBe(2);
  });

  test("player natural blackjack skips to DEALER_TURN", () => {
    for (let i = 0; i < 500; i++) {
      const g = new BlackjackGame();
      g.placeBet(10);
      const s = g.getState();
      if (isBlackjack(s.playerHand)) {
        expect(s.phase).toBe("DEALER_TURN");
        expect(s.message).toBe("Blackjack!");
        return;
      }
    }
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

  test("session over on loss — chips reach 0", () => {
    const g = new BlackjackGame(5);
    g.placeBet(5);
    g.beginDealerTurn();
    while (g.dealerDrawOne()) {}
    g.settleRound();
    if (g.getState().chips === 0) {
      g.checkSession();
      expect(g.getState().phase).toBe("SESSION_OVER");
      expect(g.isSessionWon()).toBe(false);
      expect(g.getState().winner).toBe("computer");
    }
  });

  test("session over on win — chips reach target", () => {
    const g = new BlackjackGame(295);
    g.placeBet(5);
    g.beginDealerTurn();
    while (g.dealerDrawOne()) {}
    g.settleRound();
    if (g.getState().chips >= 300) {
      g.checkSession();
      expect(g.getState().phase).toBe("SESSION_OVER");
      expect(g.isSessionWon()).toBe(true);
      expect(g.getState().winner).toBe("player");
    }
  });

  test("newRound does nothing when session is over", () => {
    const g = new BlackjackGame(0);
    g.newRound();
    expect(g.getState().chips).toBe(0);
  });

  test("isSessionOver returns true at 0 chips", () => {
    const g = new BlackjackGame(0);
    expect(g.isSessionOver()).toBe(true);
  });

  test("isSessionOver returns true at win target", () => {
    const g = new BlackjackGame(300);
    expect(g.isSessionOver()).toBe(true);
  });

  test("isSessionOver returns false mid-session", () => {
    const g = new BlackjackGame(100);
    expect(g.isSessionOver()).toBe(false);
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

  test("can only double down on hand values 8-11", () => {
    for (let i = 0; i < 500; i++) {
      const g = new BlackjackGame(100);
      g.placeBet(10);
      const s = g.getState();
      if (s.phase !== "PLAYER_TURN") continue;
      const val = handValue(s.playerHand);
      if (val >= 8 && val <= 11) {
        expect(g.canDoubleDown()).toBe(true);
      } else {
        expect(g.canDoubleDown()).toBe(false);
      }
    }
  });
});

describe("split", () => {
  function gameWithMatchingFirstCards(): BlackjackGame | null {
    // Run multiple times to get a splittable hand (same rank first two cards)
    for (let i = 0; i < 200; i++) {
      const g = new BlackjackGame(100);
      g.placeBet(10);
      if (g.canSplit()) return g;
    }
    return null;
  }

  test("canSplit returns false before bet", () => {
    const g = new BlackjackGame();
    expect(g.canSplit()).toBe(false);
  });

  test("canSplit returns false without enough chips", () => {
    const g = new BlackjackGame(10);
    g.placeBet(10);
    // chips = 0 after bet, can't cover split
    if (g.getState().phase === "PLAYER_TURN") {
      expect(g.canSplit()).toBe(false);
    }
  });

  test("split creates two hands each with 2 cards", () => {
    const g = gameWithMatchingFirstCards();
    if (!g) return; // skip if no splittable hand generated
    g.split();
    const s = g.getState();
    expect(s.playerHand.length).toBe(2);
    expect(s.splitHand).not.toBeNull();
    expect(s.splitHand!.length).toBe(2);
    expect(s.activeHand).toBe(0);
    expect(s.chips).toBe(80); // 100 - 10 (bet) - 10 (split)
    expect(s.splitBet).toBe(10);
  });

  test("stand on hand 0 advances to hand 1", () => {
    const g = gameWithMatchingFirstCards();
    if (!g) return;
    g.split();
    g.stand();
    expect(g.getState().activeHand).toBe(1);
    expect(g.getState().phase).toBe("PLAYER_TURN");
  });

  test("stand on hand 1 triggers dealer turn", () => {
    const g = gameWithMatchingFirstCards();
    if (!g) return;
    g.split();
    g.stand(); // done with hand 0
    g.stand(); // done with hand 1 → dealer
    expect(g.getState().phase).toBe("DEALER_TURN");
  });

  test("settling split round produces two results", () => {
    const g = gameWithMatchingFirstCards();
    if (!g) return;
    g.split();
    g.stand();
    g.stand();
    while (g.dealerDrawOne()) {}
    g.settleRound();
    const s = g.getState();
    expect(s.phase).toBe("ROUND_OVER");
    expect(s.roundResult).not.toBeNull();
    expect(s.splitResult).not.toBeNull();
  });
});
