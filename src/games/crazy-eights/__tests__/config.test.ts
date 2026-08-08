import { test, expect, describe } from "bun:test";
import { CardName } from "typedeck";
import { CrazyEightsGame } from "../game";
import { CRAZY_EIGHTS_FAMILY } from "../config";
import { resolvePreset } from "../../../shared/engine/variant";

describe("preset resolution", () => {
  test("base config is classic crazy eights", () => {
    const cfg = resolvePreset(CRAZY_EIGHTS_FAMILY);
    expect(cfg.wildRank).toBe(CardName.Eight);
    expect(cfg.targetScore).toBe(100);
    expect(cfg.maxDrawsPerTurn).toBeNull();
  });

  test("crazy-jacks makes jacks wild, eights normal", () => {
    const cfg = resolvePreset(CRAZY_EIGHTS_FAMILY, "crazy-jacks");
    expect(cfg.wildRank).toBe(CardName.Jack);
    expect(cfg.handSize).toBe(7);
  });

  test("draw-one caps draws at one per turn", () => {
    const cfg = resolvePreset(CRAZY_EIGHTS_FAMILY, "draw-one");
    expect(cfg.maxDrawsPerTurn).toBe(1);
    expect(cfg.wildRank).toBe(CardName.Eight);
  });
});

describe("preset matrix: full deals stay consistent", () => {
  for (const presetId of [
    undefined,
    ...Object.keys(CRAZY_EIGHTS_FAMILY.presets),
  ]) {
    test(`preset ${presetId ?? "classic"}: deal is legal`, () => {
      const game = new CrazyEightsGame(presetId);
      const cfg = game.getConfig();
      const state = game.getState();

      expect(state.playerHand).toHaveLength(cfg.handSize);
      expect(state.computerHand).toHaveLength(cfg.handSize);
      // Starter card is never wild.
      expect(state.discardPile[0]!.cardName).not.toBe(cfg.wildRank);
      // Card conservation.
      const total =
        state.playerHand.length +
        state.computerHand.length +
        state.stock.length +
        state.discardPile.length;
      expect(total).toBe(52);
    });
  }

  test("crazy-jacks: a jack is always a legal play", () => {
    const game = new CrazyEightsGame("crazy-jacks");
    const state = game.getState();
    const hand = [...state.playerHand];
    const jackIdx = hand.findIndex((c) => c.cardName === CardName.Jack);
    if (jackIdx >= 0) {
      expect(game.legalPlays(hand)).toContain(jackIdx);
    }
    const eightIdx = hand.findIndex(
      (c) =>
        c.cardName === CardName.Eight &&
        c.suit !== state.activeSuit &&
        c.cardName !== game.topCard().cardName,
    );
    if (eightIdx >= 0) {
      expect(game.legalPlays(hand)).not.toContain(eightIdx);
    }
  });
});
