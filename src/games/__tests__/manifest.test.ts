import { test, expect } from "bun:test";
import { GAMES } from "../index";
import { GameId } from "../../shared/circles/leaderboard";

const CATEGORIES = [
  "Solitaire",
  "Head-to-Head",
  "Trick-Taking",
  "Family & Kids",
];

test("game ids are unique", () => {
  const ids = GAMES.map((m) => m.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("on-chain gameIds are unique and known to the GameId registry", () => {
  const chainIds = GAMES.filter((m) => m.gameId !== undefined).map(
    (m) => m.gameId!,
  );
  expect(new Set(chainIds).size).toBe(chainIds.length);
  const known = new Set(Object.values(GameId));
  for (const id of chainIds) {
    expect(known.has(id)).toBe(true);
  }
});

test("every manifest has a valid category, title, and blurb", () => {
  for (const m of GAMES) {
    expect(CATEGORIES).toContain(m.category);
    expect(m.title.length).toBeGreaterThan(0);
    expect(m.blurb.length).toBeGreaterThan(0);
  }
});

test("every playable manifest has a loader; coming-soon games have none", () => {
  for (const m of GAMES) {
    if (m.comingSoon) {
      expect(m.load).toBeUndefined();
    } else {
      expect(typeof m.load).toBe("function");
    }
  }
});

test("loaders resolve to a UI factory", async () => {
  // Import each game's UI module without instantiating (no DOM in bun test).
  for (const m of GAMES) {
    if (!m.load) continue;
    const make = await m.load();
    expect(typeof make).toBe("function");
  }
});
