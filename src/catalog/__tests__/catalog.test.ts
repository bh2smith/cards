import { test, expect } from "bun:test";
import { ALL_ENTRIES, getEntry, searchEntries, groupedEntries } from "../index";
import { GAMES } from "../../games";
import type { FamilyDef } from "../../shared/engine/variant";
import { CRAZY_EIGHTS_FAMILY } from "../../games/crazy-eights/config";
import { MICHIGAN_FAMILY } from "../../games/michigan/config";
import { RUMMY_FAMILY } from "../../games/rummy/config";
import { GIN_FAMILY } from "../../games/gin/config";

const FAMILY_DEFS: Record<string, FamilyDef<object>> = {
  "crazy-eights": CRAZY_EIGHTS_FAMILY,
  michigan: MICHIGAN_FAMILY,
  rummy: RUMMY_FAMILY,
  gin: GIN_FAMILY,
};

test("catalog slugs are unique", () => {
  const slugs = ALL_ENTRIES.map((e) => e.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
});

test("every entry has non-empty rules prose and metadata", () => {
  for (const e of ALL_ENTRIES) {
    expect(e.rulesHtml.trim().length).toBeGreaterThan(0);
    expect(e.name.length).toBeGreaterThan(0);
    expect(e.players.length).toBeGreaterThan(0);
    expect(e.deck.length).toBeGreaterThan(0);
    expect(e.complexity).toBeGreaterThanOrEqual(1);
    expect(e.complexity).toBeLessThanOrEqual(5);
  }
});

test("playableId references a registered playable game", () => {
  const playable = new Set(
    GAMES.filter((m) => m.load && !m.comingSoon).map((m) => m.id),
  );
  for (const e of ALL_ENTRIES) {
    if (e.playableId) {
      expect(playable.has(e.playableId)).toBe(true);
    }
  }
});

test("every presetId resolves against its engine's family definition", () => {
  for (const e of ALL_ENTRIES) {
    if (!e.presetId) continue;
    expect(e.playableId).toBeDefined();
    const def = FAMILY_DEFS[e.playableId!];
    expect(def).toBeDefined();
    expect(def!.presets[e.presetId]).toBeDefined();
  }
});

test("every playable game has a catalog entry for its instructions", () => {
  for (const m of GAMES) {
    if (!m.load || m.comingSoon) continue;
    const slug = m.catalogSlug ?? m.id;
    expect(getEntry(slug)).toBeDefined();
  }
});

test("search matches names and aliases, case-insensitively", () => {
  expect(searchEntries("gin").some((e) => e.slug === "gin")).toBe(true);
  expect(searchEntries("CHEAT").some((e) => e.slug === "i-doubt-it")).toBe(
    true,
  );
  expect(searchEntries("")).toHaveLength(ALL_ENTRIES.length);
  expect(searchEntries("zzzznope")).toHaveLength(0);
});

test("grouping orders by chapter with house games last", () => {
  const groups = groupedEntries(ALL_ENTRIES);
  const labels = groups.map((g) => g.label);
  expect(labels[labels.length - 1]).toBe("Beyond the Book");
  for (const g of groups) {
    expect(g.entries.length).toBeGreaterThan(0);
  }
});
