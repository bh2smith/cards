import { test, expect, describe } from "bun:test";
import { scoreHand, gameWinner } from "../score";

describe("scoreHand", () => {
  test("makers take 3 or 4 → 1 point", () => {
    expect(scoreHand([3, 2], 0, 0, false)).toMatchObject({
      scoringTeam: 0,
      points: 1,
      kind: "made",
    });
    expect(scoreHand([1, 4], 1, 1, false)).toMatchObject({
      scoringTeam: 1,
      points: 1,
      kind: "made",
    });
  });

  test("makers sweep all 5 (march) → 2 points", () => {
    expect(scoreHand([5, 0], 0, 0, false)).toMatchObject({
      scoringTeam: 0,
      points: 2,
      kind: "march",
    });
  });

  test("loner sweep → 4 points", () => {
    expect(scoreHand([5, 0], 0, 0, true)).toMatchObject({
      scoringTeam: 0,
      points: 4,
      kind: "alone-march",
    });
  });

  test("loner who takes 3 or 4 only scores 1", () => {
    expect(scoreHand([4, 1], 0, 0, true)).toMatchObject({
      scoringTeam: 0,
      points: 1,
      kind: "made",
    });
  });

  test("makers fail to get 3 → defenders score 2 (euchre)", () => {
    expect(scoreHand([2, 3], 0, 0, false)).toMatchObject({
      scoringTeam: 1,
      points: 2,
      kind: "euchre",
    });
    expect(scoreHand([2, 3], 0, 0, true)).toMatchObject({
      scoringTeam: 1,
      points: 2,
      kind: "euchre",
    });
  });
});

describe("gameWinner", () => {
  test("first team to reach the threshold wins", () => {
    expect(gameWinner([10, 7], 10)).toBe(0);
    expect(gameWinner([8, 11], 10)).toBe(1);
    expect(gameWinner([9, 9], 10)).toBe(null);
  });
});
