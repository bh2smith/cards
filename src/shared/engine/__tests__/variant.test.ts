import { test, expect } from "bun:test";
import { resolvePreset, presetFromHash, type FamilyDef } from "../variant";

interface Cfg {
  handSize: number;
  wilds: boolean;
  target: number;
}

const def: FamilyDef<Cfg> = {
  base: { handSize: 5, wilds: false, target: 100 },
  presets: {
    "deuces-wild": { name: "Deuces Wild", overrides: { wilds: true } },
    short: { name: "Short Game", overrides: { target: 50, handSize: 4 } },
  },
};

test("no preset id resolves to the base config", () => {
  expect(resolvePreset(def)).toEqual(def.base);
});

test("preset overrides merge over the base", () => {
  expect(resolvePreset(def, "deuces-wild")).toEqual({
    handSize: 5,
    wilds: true,
    target: 100,
  });
  expect(resolvePreset(def, "short")).toEqual({
    handSize: 4,
    wilds: false,
    target: 50,
  });
});

test("unknown preset id falls back to the base config", () => {
  expect(resolvePreset(def, "nope")).toEqual(def.base);
});

test("presetFromHash reads the preset query param", () => {
  expect(presetFromHash("#/poker?preset=seven-stud")).toBe("seven-stud");
  expect(presetFromHash("#/poker")).toBeUndefined();
  expect(presetFromHash("#/poker?foo=bar")).toBeUndefined();
});
