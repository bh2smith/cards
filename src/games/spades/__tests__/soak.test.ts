import { test, expect, describe } from "bun:test";
import { SpadesGame } from "../game";
import { gameWinner } from "../score";
import type { SpadesState } from "../types";

const MAX_ACTIONS = 20_000;

/** Every card is in a hand, the current trick, or a completed trick. */
function assertConservation(s: Readonly<SpadesState>): void {
  const inHands = s.hands.reduce((sum, h) => sum + h.length, 0);
  const inTrick = s.currentTrick?.plays.length ?? 0;
  const inCompleted = s.completedTricks.reduce(
    (sum, t) => sum + t.plays.length,
    0,
  );
  expect(inHands + inTrick + inCompleted).toBe(52);
}

describe("seeded bot-only games", () => {
  for (const seed of [1, 42, 20260809]) {
    test(`seed ${seed} terminates with consistent state`, () => {
      const game = new SpadesGame(seed);
      game.autoPilot = true;

      let actions = 0;
      while (game.getState().phase !== "GAME_OVER") {
        expect(actions++).toBeLessThan(MAX_ACTIONS);
        const s = game.getState();
        switch (s.phase) {
          case "BIDDING":
            expect(game.botBid()).not.toBeNull();
            break;
          case "PLAYING":
            expect(game.botPlay()).not.toBeNull();
            if (game.getState().phase === "PLAYING") {
              assertConservation(game.getState());
            }
            break;
          case "HAND_OVER": {
            expect(s.tricksWon[0] + s.tricksWon[1]).toBe(13);
            expect(s.handResult).not.toBeNull();
            expect(gameWinner(s.scores)).toBeNull();
            game.nextHand();
            break;
          }
        }
      }

      const final = game.getState();
      expect(final.winner).not.toBeNull();
      expect(gameWinner(final.scores)).toBe(final.winner!);
    });
  }

  test("the same seed replays the same game", () => {
    const play = (seed: number): [number, number] => {
      const game = new SpadesGame(seed);
      game.autoPilot = true;
      let guard = 0;
      while (game.getState().phase !== "GAME_OVER" && guard++ < MAX_ACTIONS) {
        const s = game.getState();
        if (s.phase === "BIDDING") game.botBid();
        else if (s.phase === "PLAYING") game.botPlay();
        else game.nextHand();
      }
      return [...game.getState().scores];
    };
    expect(play(1234)).toEqual(play(1234));
  });
});
