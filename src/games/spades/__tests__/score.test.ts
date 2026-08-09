import { test, expect, describe } from "bun:test";
import { gameWinner, scoreHand } from "../score";
import type { Bid } from "../types";

type Four = [number, number, number, number];

function score(bids: Four, tricks: Four, bags: [number, number] = [0, 0]) {
  return scoreHand(bids as [Bid, Bid, Bid, Bid], tricks, bags);
}

describe("scoreHand — contracts and bags", () => {
  test("made contract with overtricks: 10 × bid + 1 per bag", () => {
    // Team 0 bids 3+2=5, takes 7 → 50 + 2 bags. Team 1 bids 4, takes 6.
    const { result, bags } = score([3, 2, 2, 2], [4, 2, 3, 4]);
    const t0 = result.teams[0]!;
    expect(t0.contract).toBe(5);
    expect(t0.tricks).toBe(7);
    expect(t0.made).toBe(true);
    expect(t0.bagsAdded).toBe(2);
    expect(t0.total).toBe(52);
    expect(bags[0]).toBe(2);

    const t1 = result.teams[1]!;
    expect(t1.contract).toBe(4);
    expect(t1.tricks).toBe(6);
    expect(t1.total).toBe(42);
    expect(bags[1]).toBe(2);
  });

  test("set contract: −10 × bid, no bags", () => {
    const { result, bags } = score([4, 3, 3, 3], [2, 4, 3, 4]);
    const t0 = result.teams[0]!;
    expect(t0.made).toBe(false);
    expect(t0.bagsAdded).toBe(0);
    expect(t0.total).toBe(-70);
    expect(bags[0]).toBe(0);
  });

  test("bag penalty at 10 bags, with spillover kept", () => {
    // 8 bags carried in, 4 added → penalty −100, counter resets to 2.
    const { result, bags } = score([2, 4, 2, 4], [4, 3, 4, 2], [8, 0]);
    const t0 = result.teams[0]!;
    expect(t0.bagsAdded).toBe(4);
    expect(t0.bagPenalties).toBe(1);
    expect(t0.total).toBe(40 + 4 - 100);
    expect(bags[0]).toBe(2);
  });
});

describe("scoreHand — nil", () => {
  test("successful nil: +100, tricks count toward partner's bid", () => {
    // Seat 0 nil (0 tricks), partner bids 5 and the team takes 5.
    const { result } = score([0, 4, 5, 4], [0, 4, 5, 4]);
    const t0 = result.teams[0]!;
    expect(t0.nils).toEqual([{ player: 0, made: true, points: 100 }]);
    expect(t0.contract).toBe(5);
    expect(t0.made).toBe(true);
    expect(t0.total).toBe(150);
  });

  test("failed nil: −100, but the nil bidder's tricks still count for the contract", () => {
    // Seat 0 nil but takes 2; partner bid 5 and took 3 → team 5 makes contract.
    const { result } = score([0, 4, 5, 4], [2, 3, 3, 5]);
    const t0 = result.teams[0]!;
    expect(t0.nils).toEqual([{ player: 0, made: false, points: -100 }]);
    expect(t0.tricks).toBe(5);
    expect(t0.made).toBe(true);
    expect(t0.total).toBe(50 - 100);
  });

  test("failed nil alongside a set contract stacks both penalties", () => {
    const { result } = score([0, 3, 6, 3], [1, 5, 3, 4]);
    const t0 = result.teams[0]!;
    expect(t0.made).toBe(false);
    expect(t0.total).toBe(-60 - 100);
  });
});

describe("gameWinner", () => {
  test("no winner mid-game", () => {
    expect(gameWinner([320, 480])).toBeNull();
  });

  test("first team to 500 wins", () => {
    expect(gameWinner([510, 320])).toBe(0);
    expect(gameWinner([320, 500])).toBe(1);
  });

  test("both cross 500 the same hand: higher total wins", () => {
    expect(gameWinner([540, 520])).toBe(0);
    expect(gameWinner([505, 561])).toBe(1);
  });

  test("a team at or below −200 loses", () => {
    expect(gameWinner([-200, 30])).toBe(1);
    expect(gameWinner([100, -230])).toBe(0);
  });
});
