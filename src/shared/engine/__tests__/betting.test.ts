import { test, expect, beforeEach } from "bun:test";
import {
  balance,
  betOptions,
  placeWager,
  winReturn,
  pushReturn,
} from "../betting";
import { resetBankrollForTests, STARTING_CHIPS } from "../bankroll";

beforeEach(() => resetBankrollForTests());

test("placing a wager deducts the stake immediately", () => {
  const w = placeWager(50)!;
  expect(w).not.toBeNull();
  expect(balance()).toBe(STARTING_CHIPS - 50);
});

test("rejects wagers the balance cannot cover, and non-positive stakes", () => {
  expect(placeWager(STARTING_CHIPS + 1)).toBeNull();
  expect(placeWager(0)).toBeNull();
  expect(placeWager(-5)).toBeNull();
  expect(balance()).toBe(STARTING_CHIPS);
});

test("win, push, and loss settle to the right balances", () => {
  const win = placeWager(10)!;
  win.settle(winReturn(10, 1)); // even money
  expect(balance()).toBe(STARTING_CHIPS + 10);

  const push = placeWager(10)!;
  push.settle(pushReturn(10));
  expect(balance()).toBe(STARTING_CHIPS + 10);

  const loss = placeWager(10)!;
  loss.settle(0);
  expect(balance()).toBe(STARTING_CHIPS);
});

test("fractional multipliers floor the profit (blackjack 3:2)", () => {
  expect(winReturn(5, 1.5)).toBe(5 + 7);
});

test("a wager settles exactly once", () => {
  const w = placeWager(10)!;
  w.settle(0);
  expect(() => w.settle(20)).toThrow();
});

test("betOptions never exceed the balance", () => {
  expect(betOptions(30)).toEqual([1, 5, 10, 25]);
  expect(betOptions(0)).toEqual([]);
});
