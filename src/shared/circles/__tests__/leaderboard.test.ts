import { test, expect } from "bun:test";
import { rankEntries, type LeaderboardEntry } from "../leaderboard";
import type { Address } from "viem";

function entry(
  player: string,
  stats: Partial<LeaderboardEntry["stats"]>,
): LeaderboardEntry {
  return {
    player: player as Address,
    stats: {
      wins: 0,
      losses: 0,
      totalCardsRemaining: 0,
      gamesPlayed: 1,
      lastPlayedAt: 0n,
      ...stats,
    },
  };
}

test("solo games rank by fewest cumulative cards remaining", () => {
  const ranked = rankEntries(
    [
      entry("0xa", { totalCardsRemaining: 40 }),
      entry("0xb", { totalCardsRemaining: 3 }),
      entry("0xc", { totalCardsRemaining: 17 }),
    ],
    true,
  );
  expect(ranked.map((e) => e.player)).toEqual(["0xb", "0xc", "0xa"]);
});

test("vs-AI games rank by net wins", () => {
  const ranked = rankEntries(
    [
      entry("0xa", { wins: 2, losses: 8 }),
      entry("0xb", { wins: 10, losses: 1 }),
      entry("0xc", { wins: 5, losses: 0 }),
    ],
    false,
  );
  expect(ranked.map((e) => e.player)).toEqual(["0xb", "0xc", "0xa"]);
});

test("ties break by games played", () => {
  const ranked = rankEntries(
    [
      entry("0xa", { totalCardsRemaining: 5, gamesPlayed: 2 }),
      entry("0xb", { totalCardsRemaining: 5, gamesPlayed: 9 }),
    ],
    true,
  );
  expect(ranked.map((e) => e.player)).toEqual(["0xb", "0xa"]);
});

test("does not mutate the input array", () => {
  const input = [
    entry("0xa", { totalCardsRemaining: 40 }),
    entry("0xb", { totalCardsRemaining: 3 }),
  ];
  rankEntries(input, true);
  expect(input[0]!.player).toBe("0xa" as Address);
});
