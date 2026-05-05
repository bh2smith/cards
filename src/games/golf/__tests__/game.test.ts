import { test, expect, describe } from "bun:test";
import { GolfGame } from "../game";
import { cardKey } from "../../../shared/deck";

describe("GolfGame", () => {
  test("starts in PLAYING phase with empty state", () => {
    const game = new GolfGame();
    const state = game.getState();
    expect(state.phase).toBe("PLAYING");
    expect(state.tableau).toEqual([]);
    expect(state.stock).toEqual([]);
    expect(state.waste).toBeNull();
  });

  test("deal produces 7 columns of 5 cards each", () => {
    const game = new GolfGame();
    game.deal();
    const state = game.getState();
    expect(state.tableau.length).toBe(7);
    for (const col of state.tableau) {
      expect(col.length).toBe(5);
    }
  });

  test("deal produces correct card counts (35 tableau + 1 waste + 16 stock = 52)", () => {
    const game = new GolfGame();
    game.deal();
    const state = game.getState();

    const tableauCount = state.tableau.reduce((sum, col) => sum + col.length, 0);
    expect(tableauCount).toBe(35);
    expect(state.waste).not.toBeNull();
    expect(state.stock.length).toBe(16);
    expect(tableauCount + 1 + state.stock.length).toBe(52);
  });

  test("deal produces no duplicate cards", () => {
    const game = new GolfGame();
    game.deal();
    const state = game.getState();

    const allCards = [
      ...state.tableau.flat(),
      ...state.stock,
      state.waste!,
    ];
    expect(allCards.length).toBe(52);

    const keys = new Set(allCards.map(cardKey));
    expect(keys.size).toBe(52);
  });

  test("deal sets phase to PLAYING", () => {
    const game = new GolfGame();
    game.deal();
    expect(game.getState().phase).toBe("PLAYING");
  });

  test("deal sets a message", () => {
    const game = new GolfGame();
    game.deal();
    expect(game.getState().message.length).toBeGreaterThan(0);
  });
});
