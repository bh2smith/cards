import { test, expect } from "bun:test";
import { RummyGame } from "../game";
import type { RummyState } from "../types";
import { cardKey } from "../../../shared/deck";

const PRESETS: { id: string | undefined; label: string }[] = [
  { id: undefined, label: "straight" },
  { id: "knock-rummy", label: "knock-rummy" },
  { id: "500-rum", label: "500-rum" },
  { id: "boathouse", label: "boathouse" },
  { id: "oklahoma-rum", label: "oklahoma-rum" },
];

const STEP_BUDGET = 5000;
const SEEDS = [1, 2, 3];

function assertConserved(state: Readonly<RummyState>): void {
  const keys = [
    ...state.playerHand,
    ...state.computerHand,
    ...state.stock,
    ...state.discardPile,
    ...state.tableMelds.flatMap((m) => m.cards),
  ].map(cardKey);
  expect(keys.length).toBe(52);
  expect(new Set(keys).size).toBe(52);
}

for (const preset of PRESETS) {
  test(`soak ${preset.label}: seeded bot-vs-bot games terminate with consistent books`, () => {
    for (const seed of SEEDS) {
      const game = new RummyGame(preset.id, seed);
      game.autoPilot = true;
      const totals = { player: 0, computer: 0 };
      let steps = 0;
      assertConserved(game.getState());

      while (game.getState().phase !== "GAME_OVER" && steps++ < STEP_BUDGET) {
        if (game.getState().phase === "ROUND_OVER") {
          const d = game.getState().roundDeltas!;
          totals.player += d.player;
          totals.computer += d.computer;
          game.nextRound();
        } else {
          game.botTurn();
        }
        assertConserved(game.getState());
      }

      expect(game.getState().phase).toBe("GAME_OVER");
      const last = game.getState().roundDeltas!;
      totals.player += last.player;
      totals.computer += last.computer;
      expect(game.getState().playerScore).toBe(totals.player);
      expect(game.getState().computerScore).toBe(totals.computer);
      expect(game.getState().winner).not.toBeNull();

      const target = game.getConfig().targetScore;
      expect(
        Math.max(game.getState().playerScore, game.getState().computerScore),
      ).toBeGreaterThanOrEqual(target);
    }
  });
}

test("same preset and seed replays the same deal", () => {
  const a = new RummyGame(undefined, 42).getState();
  const b = new RummyGame(undefined, 42).getState();
  expect(a.playerHand.map(cardKey)).toEqual(b.playerHand.map(cardKey));
  expect(a.computerHand.map(cardKey)).toEqual(b.computerHand.map(cardKey));
  expect(a.discardPile.map(cardKey)).toEqual(b.discardPile.map(cardKey));
});
