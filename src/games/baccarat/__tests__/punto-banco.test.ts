import { test, expect, beforeEach, describe } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import { BaccaratGame } from "../game";
import { balance } from "../../../shared/engine/betting";
import { resetBankrollForTests } from "../../../shared/engine/bankroll";

function c(name: CardName, suit = Suit.Spades): PlayingCard {
  return { cardName: name, suit } as PlayingCard;
}

beforeEach(() => resetBankrollForTests());

// Shoe fixture order: P1, B1, P2, B2, then player third, then banker third.
const PLAYER_NATURAL_9 = [
  c(CardName.Four),
  c(CardName.Two),
  c(CardName.Five, Suit.Hearts),
  c(CardName.Three),
]; // Player 9 (natural), Banker 5
const BANKER_NATURAL_9 = [
  c(CardName.Two),
  c(CardName.Four),
  c(CardName.Three),
  c(CardName.Five, Suit.Hearts),
]; // Player 5, Banker 9 (natural)
const NATURAL_TIE_8 = [
  c(CardName.Three),
  c(CardName.King),
  c(CardName.Five, Suit.Hearts),
  c(CardName.Eight),
]; // Player 8, Banker 8 — natural tie

describe("naturals", () => {
  test("a natural ends the coup after four cards", () => {
    const game = new BaccaratGame(undefined, 1);
    game.setShoeForTests(PLAYER_NATURAL_9);
    game.placeBets([{ on: "player", amount: 5 }]);
    game.deal();
    const s = game.getState();
    expect(s.phase).toBe("COUP_OVER");
    expect(s.result).toEqual({
      outcome: "player",
      natural: true,
      playerTotal: 9,
      bankerTotal: 5,
    });
    expect(s.playerCards.length).toBe(2);
    expect(s.bankerCards.length).toBe(2);
  });

  test("a banker natural blocks the player's draw entirely", () => {
    const game = new BaccaratGame(undefined, 1);
    // Player 2 (would draw on the tableau), Banker natural 9.
    game.setShoeForTests([
      c(CardName.Two),
      c(CardName.Four),
      c(CardName.King),
      c(CardName.Five, Suit.Hearts),
    ]);
    game.placeBets([{ on: "banker", amount: 5 }]);
    game.deal();
    const s = game.getState();
    expect(s.playerCards.length).toBe(2);
    expect(s.result!.natural).toBe(true);
    expect(s.result!.outcome).toBe("banker");
  });
});

describe("third-card play", () => {
  test("player draws on 5; banker 6 stands against a third-card 4", () => {
    const game = new BaccaratGame(undefined, 1);
    // P: 2+3=5 draws 4 -> 9. B: 3+3=6 stands vs third 4.
    game.setShoeForTests([
      c(CardName.Two),
      c(CardName.Three, Suit.Hearts),
      c(CardName.Three),
      c(CardName.Three, Suit.Diamonds),
      c(CardName.Four),
    ]);
    game.placeBets([{ on: "player", amount: 5 }]);
    game.deal();
    const s = game.getState();
    expect(s.playerCards.length).toBe(3);
    expect(s.bankerCards.length).toBe(2);
    expect(s.result).toEqual({
      outcome: "player",
      natural: false,
      playerTotal: 9,
      bankerTotal: 6,
    });
  });

  test("player stands on 7; banker 5 draws when the player stood", () => {
    const game = new BaccaratGame(undefined, 1);
    // P: 3+4=7 stands. B: 2+3=5, player stood -> draws 9 -> total 4.
    game.setShoeForTests([
      c(CardName.Three),
      c(CardName.Two),
      c(CardName.Four),
      c(CardName.Three, Suit.Hearts),
      c(CardName.Nine),
    ]);
    game.placeBets([{ on: "player", amount: 5 }]);
    game.deal();
    const s = game.getState();
    expect(s.playerCards.length).toBe(2);
    expect(s.bankerCards.length).toBe(3);
    expect(s.result!.playerTotal).toBe(7);
    expect(s.result!.bankerTotal).toBe(4);
    expect(s.result!.outcome).toBe("player");
  });
});

describe("payouts through the bankroll", () => {
  test("player bet pays even money", () => {
    const game = new BaccaratGame(undefined, 1);
    game.setShoeForTests(PLAYER_NATURAL_9);
    expect(balance()).toBe(200);
    game.placeBets([{ on: "player", amount: 10 }]);
    expect(balance()).toBe(190);
    game.deal();
    expect(balance()).toBe(210);
    expect(game.getState().lastNet).toBe(10);
    expect(game.getState().winner).toBe("player");
  });

  test("banker bet pays 0.95:1 with floored commission", () => {
    const game = new BaccaratGame(undefined, 1);
    game.setShoeForTests(BANKER_NATURAL_9);
    game.placeBets([{ on: "banker", amount: 10 }]);
    game.deal();
    // 200 - 10 + (10 + floor(9.5)) = 209
    expect(balance()).toBe(209);
    expect(game.getState().lastNet).toBe(9);
  });

  test("banker commission floors on odd stakes", () => {
    const game = new BaccaratGame(undefined, 1);
    game.setShoeForTests(BANKER_NATURAL_9);
    game.placeBets([{ on: "banker", amount: 5 }]);
    game.deal();
    // 200 - 5 + (5 + floor(4.75)) = 204
    expect(balance()).toBe(204);
  });

  test("tie bet pays 8:1 while side bets push", () => {
    const game = new BaccaratGame(undefined, 1);
    game.setShoeForTests(NATURAL_TIE_8);
    game.placeBets([
      { on: "player", amount: 10 },
      { on: "banker", amount: 10 },
      { on: "tie", amount: 5 },
    ]);
    expect(balance()).toBe(175);
    game.deal();
    // Player and banker stakes returned; tie returns 5 + 40.
    expect(balance()).toBe(240);
    expect(game.getState().lastNet).toBe(40);
  });

  test("a lone player bet pushes on a tie", () => {
    const game = new BaccaratGame(undefined, 1);
    game.setShoeForTests(NATURAL_TIE_8);
    game.placeBets([{ on: "player", amount: 10 }]);
    game.deal();
    expect(balance()).toBe(200);
    expect(game.getState().lastNet).toBe(0);
    expect(game.getState().winner).toBeNull();
  });

  test("losing bets are gone", () => {
    const game = new BaccaratGame(undefined, 1);
    game.setShoeForTests(BANKER_NATURAL_9);
    game.placeBets([{ on: "player", amount: 10 }]);
    game.deal();
    expect(balance()).toBe(190);
    expect(game.getState().winner).toBe("computer");
  });
});

describe("bet validation", () => {
  test("rejects bets beyond the balance", () => {
    const game = new BaccaratGame(undefined, 1);
    expect(game.placeBets([{ on: "player", amount: 500 }])).toBe(false);
    expect(balance()).toBe(200);
  });

  test("rejects empty or zero bets, and cannot deal without a bet", () => {
    const game = new BaccaratGame(undefined, 1);
    expect(game.placeBets([])).toBe(false);
    expect(game.placeBets([{ on: "tie", amount: 0 }])).toBe(false);
    expect(game.canDeal()).toBe(false);
    expect(game.deal()).toBe(false);
  });
});

test("the shoe reshuffles when fewer than 20 cards remain", () => {
  const game = new BaccaratGame(undefined, 7);
  expect(game.getState().shoeCount).toBe(312);
  let prev = game.getState().shoeCount;
  let reshuffles = 0;
  for (let i = 0; i < 80; i++) {
    game.placeBets([{ on: "player", amount: 1 }]);
    game.deal();
    const s = game.getState();
    const dealt = s.playerCards.length + s.bankerCards.length;
    if (prev < 20) {
      expect(s.shoeCount).toBe(312 - dealt);
      reshuffles++;
    } else {
      expect(s.shoeCount).toBe(prev - dealt);
    }
    prev = s.shoeCount;
    game.nextCoup();
  }
  expect(reshuffles).toBeGreaterThan(0);
});
