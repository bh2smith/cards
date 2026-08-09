import { test, expect } from "bun:test";
import type { PlayerIndex, WhistState } from "../types";
import { autoGame, stepUntil } from "./helpers";

test("hand 1 deals 7 cards each and turns trump from the deck", () => {
  const game = autoGame("knockout", 5);
  game.deal();
  const s = game.getState();

  expect(s.phase).toBe("PLAYING");
  expect(s.handSize).toBe(7);
  for (const hand of s.hands) expect(hand.length).toBe(7);
  expect(s.trumpCard).not.toBeNull();
  expect(s.trumpCardInHand).toBe(false);
  expect(s.trump).toBe(s.trumpCard!.suit);
  expect(s.stock.length).toBe(52 - 28 - 1);
  expect(s.currentTurn).toBe(s.eldest);
});

test("deals descend, zero-trick players are knocked out, chooser has most tricks", () => {
  const game = autoGame("knockout", 31);
  let prePhase = game.getState().phase;
  let preState: Readonly<WhistState> | null = null;
  const sizesByHand = new Map<number, number>();

  stepUntil(
    game,
    (s) => s.phase === "GAME_OVER",
    6000,
    (s) => {
      if (s.phase === "PLAYING") sizesByHand.set(s.handNumber, s.handSize);
      const wasPlaying = prePhase === "PLAYING";
      if (wasPlaying && (s.phase === "HAND_OVER" || s.phase === "GAME_OVER")) {
        // preState is the snapshot just before the hand-ending trick resolved.
        const before = preState!;
        const contenders = ([0, 1, 2, 3] as PlayerIndex[]).filter(
          (p) => !before.eliminated[p],
        );
        for (const p of contenders) {
          expect(s.eliminated[p]).toBe(s.trickCounts[p] === 0);
        }
        if (s.phase === "HAND_OVER") {
          const chooser = s.trumpChooser!;
          const max = Math.max(...contenders.map((p) => s.trickCounts[p]!));
          expect(s.trickCounts[chooser]).toBe(max);
          // Earliest in rotation from eldest among the tied.
          for (let i = 0; i < 4; i++) {
            const seat = ((s.eldest + i) % 4) as PlayerIndex;
            if (seat === chooser) break;
            if (!contenders.includes(seat)) continue;
            expect(s.trickCounts[seat]!).toBeLessThan(max);
          }
        }
      }
      prePhase = s.phase;
      preState = structuredClone(s) as Readonly<WhistState>;
    },
  );

  for (const [hand, size] of sizesByHand) {
    expect(size).toBe(8 - hand);
  }
});

test("bot trump chooser picks its longest suit", () => {
  const game = autoGame("knockout", 11);
  stepUntil(game, (s) => s.phase === "TRUMP_PICK" || s.phase === "GAME_OVER");
  const s = game.getState();
  if (s.phase === "GAME_OVER") throw new Error("game ended before a pick");

  const hand = [...s.hands[s.currentTurn]!];
  const counts = new Map<number, number>();
  for (const c of hand) counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1);
  const max = Math.max(...counts.values());

  expect(game.botStep()).toBe(true);
  const after = game.getState();
  expect(after.phase).toBe("PLAYING");
  expect(counts.get(after.trump!)).toBe(max);
  expect(after.currentTurn).toBe(after.currentTrick!.leader);
});

test("last player standing wins the game", () => {
  for (const seed of [2, 71]) {
    const game = autoGame("knockout", seed);
    stepUntil(game, (s) => s.phase === "GAME_OVER");
    const s = game.getState();
    const survivors = ([0, 1, 2, 3] as PlayerIndex[]).filter(
      (p) => !s.eliminated[p],
    );
    const champion = survivors[0] ?? s.lastTrickWinner!;
    expect(survivors.length).toBeLessThanOrEqual(1);
    expect(s.winner).toBe(champion === 0 ? "player" : "computer");
  }
});
