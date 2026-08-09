import { test, expect } from "bun:test";
import { allCardKeys, autoGame, stepUntil } from "./helpers";

const PRESETS: (string | undefined)[] = [
  undefined,
  "knockout",
  "oh-hell",
  "norwegian",
];
const SEEDS = [11, 222];

for (const preset of PRESETS) {
  const name = preset ?? "whist (base)";
  for (const seed of SEEDS) {
    test(`${name} seed ${seed}: bot-only game reaches GAME_OVER with cards and scores consistent`, () => {
      const game = autoGame(preset, seed);
      stepUntil(
        game,
        (s) => s.phase === "GAME_OVER",
        12000,
        (s) => {
          if (s.handNumber > 0) {
            const cards = allCardKeys(s);
            expect(cards.length).toBe(52);
            expect(new Set(cards).size).toBe(52);
          }
          const trickSum = s.trickCounts.reduce((a, b) => a + b, 0);
          expect(trickSum).toBe(s.completedTricks.length);
          for (const score of [...s.teamScores, ...s.scores]) {
            expect(score).toBeGreaterThanOrEqual(0);
          }
        },
      );
      const final = game.getState();
      expect(final.phase).toBe("GAME_OVER");
      expect(final.winner).not.toBeNull();
      expect(final.message.length).toBeGreaterThan(0);
    });
  }
}

test("same seed replays the same game", () => {
  const run = (): unknown => {
    const game = autoGame(undefined, 77);
    stepUntil(game, (s) => s.phase === "GAME_OVER");
    const s = game.getState();
    return [s.teamScores, s.handNumber, s.message];
  };
  expect(run()).toEqual(run());
});

test("newGame resets to PRE_DEAL", () => {
  const game = autoGame("knockout", 19);
  stepUntil(game, (s) => s.phase === "GAME_OVER");
  game.newGame();
  const s = game.getState();
  expect(s.phase).toBe("PRE_DEAL");
  expect(s.handNumber).toBe(0);
  expect(s.eliminated).toEqual([false, false, false, false]);
  expect(s.teamScores).toEqual([0, 0]);
});
