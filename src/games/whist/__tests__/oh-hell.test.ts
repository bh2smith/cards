import { test, expect } from "bun:test";
import type { PlayerIndex, WhistState } from "../types";
import { autoGame, stepUntil } from "./helpers";

test("hand sizes run 1..10 and the match ends after hand 10", () => {
  const game = autoGame("oh-hell", 3);
  const sizesByHand = new Map<number, number>();
  stepUntil(
    game,
    (s) => s.phase === "GAME_OVER",
    6000,
    (s) => {
      if (s.phase === "BIDDING" || s.phase === "PLAYING") {
        sizesByHand.set(s.handNumber, s.handSize);
      }
    },
  );
  expect(sizesByHand.size).toBe(10);
  for (const [hand, size] of sizesByHand) expect(size).toBe(hand);
  expect(game.getState().handNumber).toBe(10);
});

test("completed bids never sum to the hand size (dealer hook, bots included)", () => {
  for (const seed of [8, 99]) {
    const game = autoGame("oh-hell", seed);
    let handsChecked = 0;
    stepUntil(
      game,
      (s) => s.phase === "GAME_OVER",
      6000,
      (s) => {
        if (s.phase === "PLAYING" && s.bids.every((b) => b !== null)) {
          const sum = s.bids.reduce((a: number, b) => a + b!, 0);
          if (
            s.completedTricks.length === 0 &&
            s.currentTrick?.plays.length === 0
          ) {
            expect(sum).not.toBe(s.handSize);
            handsChecked++;
          }
        }
      },
    );
    expect(handsChecked).toBeGreaterThan(0);
  }
});

test("the human dealer cannot bid the hook value", () => {
  const game = autoGame("oh-hell", 17);
  // Hand 2 is dealt by seat 0; stop when the dealer (human) is to bid.
  stepUntil(
    game,
    (s) =>
      s.phase === "BIDDING" && s.currentTurn === s.dealer && s.dealer === 0,
  );
  const s = game.getState();
  const forbidden = game.forbiddenBid();
  if (forbidden !== null) {
    expect(game.bid(0, forbidden)).toBe(false);
    const legal = forbidden === 0 ? 1 : forbidden - 1;
    expect(game.bid(0, legal)).toBe(true);
  } else {
    // Others overbid the hand; every in-range value is allowed.
    expect(game.bid(0, 0)).toBe(true);
  }
  expect(game.getState().phase).toBe("PLAYING");
});

test("exact bids score 10 + bid, misses score zero", () => {
  const game = autoGame("oh-hell", 21);
  let prev: Readonly<WhistState> | null = null;
  let handsChecked = 0;
  stepUntil(
    game,
    (s) => s.phase === "GAME_OVER",
    6000,
    (s) => {
      if (
        prev?.phase === "PLAYING" &&
        (s.phase === "HAND_OVER" || s.phase === "GAME_OVER")
      ) {
        for (const seat of [0, 1, 2, 3] as PlayerIndex[]) {
          const bid = s.bids[seat]!;
          const made = s.trickCounts[seat] === bid;
          const delta = s.scores[seat]! - prev.scores[seat]!;
          expect(delta).toBe(made ? 10 + bid : 0);
        }
        handsChecked++;
      }
      prev = structuredClone(s) as Readonly<WhistState>;
    },
  );
  expect(handsChecked).toBe(10);

  const final = game.getState();
  const top = Math.max(...final.scores);
  const leaders = ([0, 1, 2, 3] as PlayerIndex[]).filter(
    (p) => final.scores[p] === top,
  );
  expect(final.winner).toBe(leaders.includes(0) ? "player" : "computer");
});
