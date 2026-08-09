import { test, expect } from "bun:test";
import { cardKey } from "../../../shared/deck";
import { autoGame, stepUntil } from "./helpers";

test("deal turns the dealer's last card as trump, kept in hand", () => {
  const game = autoGame(undefined, 42);
  game.deal();
  const s = game.getState();

  expect(s.phase).toBe("PLAYING");
  expect(s.handSize).toBe(13);
  expect(s.dealer).toBe(3);
  expect(s.eldest).toBe(0);
  expect(s.currentTurn).toBe(0); // eldest leads
  for (const hand of s.hands) expect(hand.length).toBe(13);
  expect(s.stock.length).toBe(0);

  expect(s.trumpCard).not.toBeNull();
  expect(s.trumpCardInHand).toBe(true);
  expect(s.trump).toBe(s.trumpCard!.suit);
  const dealerKeys = s.hands[s.dealer]!.map(cardKey);
  expect(dealerKeys).toContain(cardKey(s.trumpCard!));
});

test("hand scores one point per odd trick to the majority team", () => {
  const game = autoGame(undefined, 7);
  stepUntil(game, (s) => s.phase === "HAND_OVER" || s.phase === "GAME_OVER");
  const s = game.getState();
  const t0 = s.trickCounts[0]! + s.trickCounts[2]!;
  const t1 = s.trickCounts[1]! + s.trickCounts[3]!;
  expect(t0 + t1).toBe(13);
  const expected: [number, number] = t0 > t1 ? [t0 - 6, 0] : [0, t1 - 6];
  expect(s.teamScores).toEqual(expected);
});

test("dealer rotates between hands", () => {
  const game = autoGame(undefined, 9);
  stepUntil(game, (s) => s.phase === "HAND_OVER" || s.phase === "GAME_OVER");
  if (game.getState().phase === "GAME_OVER") return; // single-hand blowout
  game.deal();
  expect(game.getState().dealer).toBe(0);
  expect(game.getState().eldest).toBe(1);
});

test("game ends when a team reaches 7 points", () => {
  const game = autoGame(undefined, 123);
  stepUntil(game, (s) => s.phase === "GAME_OVER");
  const s = game.getState();
  const best = Math.max(...s.teamScores);
  expect(best).toBeGreaterThanOrEqual(7);
  expect(s.winner).toBe(s.teamScores[0]! >= 7 ? "player" : "computer");
  expect(s.message.length).toBeGreaterThan(0);
});
