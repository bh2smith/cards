import { test, expect, beforeEach } from "bun:test";
import { MichiganGame } from "../game";
import type { MichiganState } from "../types";
import { cardKey } from "../../../shared/deck";
import { resetBankrollForTests } from "../../../shared/engine/bankroll";

const TOTAL_CHIPS = 4 * 50;
const STEP_BUDGET = 3000;

beforeEach(() => resetBankrollForTests());

function totalChips(state: Readonly<MichiganState>): number {
  return (
    state.chips.reduce((a, b) => a + b, 0) +
    state.pot +
    state.boodle.reduce((a, b) => a + b.chips, 0)
  );
}

function allCards(state: Readonly<MichiganState>): string[] {
  return [...state.hands.flat(), ...state.deadHand, ...state.played].map(
    cardKey,
  );
}

const PRESETS: (string | undefined)[] = [undefined, "fan-tan", "play-or-pay"];

for (const preset of PRESETS) {
  const name = preset ?? "michigan (base)";

  test(`${name}: seeded bot-only session terminates with conserved chips and cards`, () => {
    const game = new MichiganGame(preset, 1234);
    game.autoPilot = true;
    game.deal();

    let steps = 0;
    while (game.getState().phase !== "GAME_OVER" && steps < STEP_BUDGET) {
      const state = game.getState();
      if (state.phase === "HAND_OVER") {
        game.deal();
      } else {
        expect(game.botStep()).toBe(true);
      }
      steps++;

      const after = game.getState();
      expect(totalChips(after)).toBe(TOTAL_CHIPS);
      const cards = allCards(after);
      expect(cards.length).toBe(52);
      expect(new Set(cards).size).toBe(52);
    }

    const final = game.getState();
    expect(final.phase).toBe("GAME_OVER");
    expect(final.winner).not.toBeNull();
    expect(final.handNumber).toBe(4);
    expect(final.message.length).toBeGreaterThan(0);
  });

  test(`${name}: same seed replays the same session`, () => {
    const run = (): number[] => {
      resetBankrollForTests();
      const game = new MichiganGame(preset, 42);
      game.autoPilot = true;
      game.deal();
      let steps = 0;
      while (game.getState().phase !== "GAME_OVER" && steps++ < STEP_BUDGET) {
        if (game.getState().phase === "HAND_OVER") game.deal();
        else game.botStep();
      }
      return [...game.getState().chips];
    };
    expect(run()).toEqual(run());
  });
}

test("newSession resets to PRE_DEAL with fresh chips", () => {
  const game = new MichiganGame("fan-tan", 7);
  game.autoPilot = true;
  game.deal();
  let steps = 0;
  while (game.getState().phase !== "GAME_OVER" && steps++ < STEP_BUDGET) {
    if (game.getState().phase === "HAND_OVER") game.deal();
    else game.botStep();
  }
  expect(game.getState().phase).toBe("GAME_OVER");
  game.newSession();
  const state = game.getState();
  expect(state.phase).toBe("PRE_DEAL");
  expect(state.chips).toEqual([50, 50, 50, 50]);
  expect(state.handNumber).toBe(0);
});
