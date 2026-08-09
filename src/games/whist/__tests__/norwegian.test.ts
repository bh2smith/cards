import { test, expect } from "bun:test";
import { WhistGame } from "../game";
import { norwegianHandPoints } from "../modes/norwegian";
import { autoGame, stepUntil } from "./helpers";

test("declaring rotates from eldest; the first declaration fixes the hand", () => {
  const game = new WhistGame("norwegian", 4);
  game.deal();
  let s = game.getState();
  expect(s.phase).toBe("DECLARING");
  expect(s.currentTurn).toBe(0); // eldest first (dealer is 3)
  expect(s.trump).toBeNull();

  expect(game.declare(1, "grand")).toBe(false); // not their turn
  expect(game.declare(0, "pass")).toBe(true);
  expect(game.getState().currentTurn).toBe(1);
  expect(game.declare(1, "grand")).toBe(true);

  s = game.getState();
  expect(s.phase).toBe("PLAYING");
  expect(s.handType).toBe("grand");
  expect(s.declarer).toBe(1);
  expect(s.currentTurn).toBe(s.eldest); // eldest leads
  expect(s.trump).toBeNull(); // never any trump
});

test("all four passing makes the hand nullo with no declarer", () => {
  const game = new WhistGame("norwegian", 4);
  game.deal();
  for (const seat of [0, 1, 2, 3] as const) {
    expect(game.declare(seat, "pass")).toBe(true);
  }
  const s = game.getState();
  expect(s.phase).toBe("PLAYING");
  expect(s.handType).toBe("nullo");
  expect(s.declarer).toBeNull();
});

test("norwegianHandPoints covers both polarities", () => {
  // Grand, declaring side takes 8 tricks: 2 odd × 4.
  expect(norwegianHandPoints(8, 5, "grand", 0)).toEqual([8, 0]);
  // Grand, defenders take 8 tricks: 2 odd × 8.
  expect(norwegianHandPoints(8, 5, "grand", 1)).toEqual([16, 0]);
  // Nullo: odd tricks score against the side taking them.
  expect(norwegianHandPoints(8, 5, "nullo", null)).toEqual([0, 4]);
  expect(norwegianHandPoints(0, 13, "nullo", 2 as never)).toEqual([14, 0]);
  // 7–6 split: exactly one odd trick.
  expect(norwegianHandPoints(7, 6, "grand", 0)).toEqual([4, 0]);
  expect(norwegianHandPoints(6, 7, "nullo", null)).toEqual([2, 0]);
});

test("hand scoring applies norwegianHandPoints to the team totals", () => {
  const game = autoGame("norwegian", 13);
  stepUntil(game, (s) => s.phase === "HAND_OVER" || s.phase === "GAME_OVER");
  const s = game.getState();
  const t0 = s.trickCounts[0]! + s.trickCounts[2]!;
  const t1 = s.trickCounts[1]! + s.trickCounts[3]!;
  expect(t0 + t1).toBe(13);
  const declTeam = s.declarer === null ? null : ((s.declarer % 2) as 0 | 1);
  expect(s.teamScores).toEqual(
    norwegianHandPoints(t0, t1, s.handType!, declTeam),
  );
});

test("game runs trumpless to 50", () => {
  const game = autoGame("norwegian", 6);
  stepUntil(
    game,
    (s) => s.phase === "GAME_OVER",
    12000,
    (s) => expect(s.trump).toBeNull(),
  );
  const s = game.getState();
  const best = Math.max(...s.teamScores);
  expect(best).toBeGreaterThanOrEqual(50);
  expect(s.winner).toBe(
    s.teamScores[0]! >= s.teamScores[1]! ? "player" : "computer",
  );
});
