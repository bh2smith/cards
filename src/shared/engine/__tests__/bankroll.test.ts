import { test, expect, beforeEach } from "bun:test";
import {
  getBankroll,
  adjustBankroll,
  resetBankrollForTests,
  STARTING_CHIPS,
  DAILY_TOPUP,
} from "../bankroll";

beforeEach(() => resetBankrollForTests());

test("new players start with the seed bankroll", () => {
  expect(getBankroll()).toBe(STARTING_CHIPS);
});

test("wins and losses adjust the balance, floored at zero", () => {
  expect(adjustBankroll(50)).toBe(STARTING_CHIPS + 50);
  expect(adjustBankroll(-10_000)).toBe(0);
});

test("a broke player is topped up once per day", () => {
  adjustBankroll(-STARTING_CHIPS);
  const day1 = new Date("2026-08-07T10:00:00Z");
  expect(getBankroll(day1)).toBe(DAILY_TOPUP);

  // Losing it again the same day does not re-trigger the top-up.
  adjustBankroll(-DAILY_TOPUP);
  expect(getBankroll(day1)).toBe(0);

  // A new day tops back up.
  const day2 = new Date("2026-08-08T10:00:00Z");
  expect(getBankroll(day2)).toBe(DAILY_TOPUP);
});

test("a healthy balance is never topped up", () => {
  adjustBankroll(500);
  expect(getBankroll(new Date("2026-08-09T10:00:00Z"))).toBe(
    STARTING_CHIPS + 500,
  );
});
