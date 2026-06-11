import { test, expect, describe } from "bun:test";
import { Suit } from "typedeck";
import { EuchreGame } from "../game";
import { cardKey } from "../../../shared/deck";
import type { EuchreGame as Game } from "../game";

const ALL_SUITS = [Suit.Clubs, Suit.Diamonds, Suit.Spades, Suit.Hearts];

describe("deal", () => {
  test("deals 5 to each, an up-card, and a 3-card kitty from 24 unique cards", () => {
    const game = new EuchreGame();
    const s = game.getState();
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.upCard).not.toBeNull();
    expect(s.kitty.length).toBe(3);

    const keys = new Set<string>();
    for (const h of s.hands) for (const c of h) keys.add(cardKey(c));
    keys.add(cardKey(s.upCard!));
    for (const c of s.kitty) keys.add(cardKey(c));
    expect(keys.size).toBe(24);
  });

  test("opens in round-1 bidding with You as eldest hand", () => {
    const s = new EuchreGame().getState();
    expect(s.phase).toBe("BID1");
    expect(s.dealer).toBe(3);
    expect(s.bidTurn).toBe(0);
  });
});

describe("ordering up", () => {
  test("a bot dealer picks up and discards, then play begins", () => {
    const game = new EuchreGame();
    const upSuit = game.getState().upCard!.suit;
    expect(game.orderUp(0, false)).toBe(true);

    const s = game.getState();
    expect(s.phase).toBe("PLAYING");
    expect(s.trump).toBe(upSuit);
    expect(s.maker).toBe(0);
    expect(s.upCard).toBeNull();
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.currentTrick!.leader).toBe(0); // dealer 3 → eldest 0 leads
  });
});

describe("round 2 and stick-the-dealer", () => {
  test("passing out round 1 turns the card down and opens round 2", () => {
    const game = new EuchreGame();
    const upSuit = game.getState().upCard!.suit;
    game.pass(0);
    game.pass(1);
    game.pass(2);
    game.pass(3); // dealer passes → round 2

    const s = game.getState();
    expect(s.phase).toBe("BID2");
    expect(s.turnedDownSuit).toBe(upSuit);
    expect(s.bidTurn).toBe(0);
  });

  test("the dealer cannot pass in round 2", () => {
    const game = new EuchreGame();
    game.pass(0);
    game.pass(1);
    game.pass(2);
    game.pass(3);
    game.pass(0);
    game.pass(1);
    game.pass(2); // now it is the dealer's turn (3)
    const s = game.getState();
    expect(s.bidTurn).toBe(3);
    expect(game.canPass(3)).toBe(false);
    expect(game.pass(3)).toBe(false);
  });
});

describe("going alone", () => {
  test("the maker's partner sits out and tricks have three cards", () => {
    const game = new EuchreGame();
    game.pass(0);
    game.pass(1);
    game.pass(2);
    game.pass(3); // → BID2, bidTurn 0
    const upSuit = game.getState().upCard!.suit;
    const namedSuit = ALL_SUITS.find((x) => x !== upSuit)!;
    expect(game.nameTrump(0, namedSuit, true)).toBe(true);

    const s0 = game.getState();
    expect(s0.alone).toBe(true);
    expect(s0.aloneSitter).toBe(2); // partner of maker 0

    const played = new Set<number>();
    let guard = 0;
    while (game.getState().phase === "PLAYING" && guard++ < 50) {
      const p = game.getState().currentTurn;
      played.add(p);
      const legal = game.legalPlaysFor(p);
      game.playCard(p, legal[0]!);
    }

    expect(played.has(2)).toBe(false); // partner never played
    const s = game.getState();
    expect(s.completedTricks.length).toBe(5);
    for (const t of s.completedTricks) expect(t.plays.length).toBe(3);
  });
});

// Drive an entire game with arbitrary legal moves to exercise the full machine.
function driveToGameOver(game: Game): void {
  let guard = 0;
  while (guard++ < 4000) {
    const s = game.getState();
    if (s.phase === "GAME_OVER") return;
    if (s.phase === "HAND_OVER") {
      game.nextHand();
    } else if (s.phase === "BID1" || s.phase === "BID2") {
      game.botBid();
    } else if (s.phase === "DISCARD") {
      game.discard(s.dealer, s.hands[s.dealer]![0]!);
    } else {
      const p = s.currentTurn;
      game.playCard(p, game.legalPlaysFor(p)[0]!);
    }
  }
  throw new Error("game did not terminate");
}

describe("full game flow", () => {
  test("a single hand scores exactly five tricks", () => {
    const game = new EuchreGame();
    // drive only bidding + one hand
    let guard = 0;
    while (guard++ < 200) {
      const s = game.getState();
      if (s.phase === "BID1" || s.phase === "BID2") game.botBid();
      else if (s.phase === "DISCARD")
        game.discard(s.dealer, s.hands[s.dealer]![0]!);
      else break;
    }
    // now PLAYING
    guard = 0;
    while (game.getState().phase === "PLAYING" && guard++ < 60) {
      const p = game.getState().currentTurn;
      game.playCard(p, game.legalPlaysFor(p)[0]!);
    }
    const s = game.getState();
    expect(s.completedTricks.length).toBe(5);
    expect(s.trickWins[0] + s.trickWins[1]).toBe(5);
    expect(s.handResult).not.toBeNull();
    expect(["HAND_OVER", "GAME_OVER"]).toContain(s.phase);
    expect(s.scores[0] + s.scores[1]).toBeGreaterThan(0);
  });

  test("plays through to a winner at 10 points", () => {
    const game = new EuchreGame();
    driveToGameOver(game);
    const s = game.getState();
    expect(s.winner).not.toBeNull();
    expect(Math.max(s.scores[0], s.scores[1])).toBeGreaterThanOrEqual(10);
  });

  test("the dealer rotates clockwise between hands", () => {
    const game = new EuchreGame();
    expect(game.getState().dealer).toBe(3);
    game.nextHand();
    expect(game.getState().dealer).toBe(0);
    game.nextHand();
    expect(game.getState().dealer).toBe(1);
  });
});

describe("bot play", () => {
  test("botPlay returns a legal card for the current bot", () => {
    const game = new EuchreGame();
    game.orderUp(0, false); // start a hand quickly
    while (game.getState().currentTurn === 0) {
      const p = game.getState().currentTurn;
      game.playCard(p, game.legalPlaysFor(p)[0]!);
    }
    const before = game.getState().currentTurn;
    expect(before).not.toBe(0);
    const card = game.botPlay();
    expect(card).not.toBeNull();
  });
});
