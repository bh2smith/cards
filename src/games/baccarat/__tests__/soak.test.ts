import { test, expect, beforeEach } from "bun:test";
import { BaccaratGame } from "../game";
import { cardKey, seededRng } from "../../../shared/deck";
import { balance } from "../../../shared/engine/betting";
import { resetBankrollForTests } from "../../../shared/engine/bankroll";
import type { BetKind } from "../types";

const SHOE_SIZE = 6 * 52;
const COPIES_PER_SHOE = 6;

beforeEach(() => resetBankrollForTests());

test("50-coup punto banco soak conserves the shoe and the bankroll", () => {
  const game = new BaccaratGame(undefined, 99);
  const kinds: BetKind[] = ["player", "banker", "tie"];
  let dealtSinceShuffle = new Map<string, number>();
  let prev = game.getState().shoeCount;

  for (let coup = 0; coup < 50; coup++) {
    expect(game.placeBets([{ on: kinds[coup % 3]!, amount: 1 }])).toBe(true);
    expect(game.deal()).toBe(true);
    const s = game.getState();
    expect(s.phase).toBe("COUP_OVER");

    const coupCards = [...s.playerCards, ...s.bankerCards];
    expect(coupCards.length).toBeGreaterThanOrEqual(4);
    expect(coupCards.length).toBeLessThanOrEqual(6);

    const reshuffled = prev < 20;
    if (reshuffled) dealtSinceShuffle = new Map();
    expect(s.shoeCount).toBe(
      (reshuffled ? SHOE_SIZE : prev) - coupCards.length,
    );

    for (const card of coupCards) {
      const key = cardKey(card);
      const count = (dealtSinceShuffle.get(key) ?? 0) + 1;
      expect(count).toBeLessThanOrEqual(COPIES_PER_SHOE);
      dealtSinceShuffle.set(key, count);
    }
    const dealtTotal = [...dealtSinceShuffle.values()].reduce(
      (a, b) => a + b,
      0,
    );
    expect(dealtTotal + s.shoeCount).toBe(SHOE_SIZE);

    expect(balance()).toBeGreaterThanOrEqual(0);
    prev = s.shoeCount;
    game.nextCoup();
  }
});

test("50-coup chemin de fer soak keeps every purse non-negative", () => {
  const game = new BaccaratGame("chemin-de-fer", 123);
  const rng = seededRng(5);

  for (let coup = 0; coup < 50; coup++) {
    let s = game.getState();
    expect(s.phase).toBe("BETTING");
    if (s.bankerSeat === 0 && s.bankStake === 0 && balance() > 0) {
      expect(game.stakeBank(Math.min(5, balance()))).toBe(true);
    }
    const prev = game.getState().shoeCount;
    expect(game.deal()).toBe(true);

    if (game.getState().phase === "PUNTER_DECISION") {
      if (rng() < 0.5) game.punterDraw();
      else game.punterStand();
    }
    if (game.getState().phase === "BANKER_DECISION") {
      if (rng() < 0.5) game.bankerKeep();
      else game.bankerPass();
    }

    s = game.getState();
    expect(s.phase).toBe("COUP_OVER");
    const dealt = s.playerCards.length + s.bankerCards.length;
    expect(s.shoeCount).toBe((prev < 20 ? SHOE_SIZE : prev) - dealt);
    expect(balance()).toBeGreaterThanOrEqual(0);
    expect(s.botPurses[0]).toBeGreaterThanOrEqual(0);
    expect(s.botPurses[1]).toBeGreaterThanOrEqual(0);
    game.nextCoup();
  }
});
