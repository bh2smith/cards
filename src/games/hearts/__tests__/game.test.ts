import { test, expect, describe } from "bun:test";
import { CardName, Suit } from "typedeck";
import { HeartsGame } from "../game";
import { cardKey } from "../../../shared/deck";
import {
  type PlayerIndex,
  isTwoOfClubs,
  passDirectionForRound,
  passTarget,
} from "../types";

describe("HeartsGame.deal", () => {
  test("each player gets 13 cards, 52 total unique", () => {
    const game = new HeartsGame();
    const state = game.getState();
    const all = state.hands.flat();
    expect(all).toHaveLength(52);
    expect(new Set(all.map(cardKey)).size).toBe(52);
    state.hands.forEach((h) => expect(h).toHaveLength(13));
  });

  test("starts in PASSING phase on round 1 (left)", () => {
    const game = new HeartsGame();
    expect(game.getState().phase).toBe("PASSING");
    expect(game.getState().passDirection).toBe("left");
  });
});

describe("passDirection rotation", () => {
  test("rotates left → right → across → hold → left ...", () => {
    expect(passDirectionForRound(1)).toBe("left");
    expect(passDirectionForRound(2)).toBe("right");
    expect(passDirectionForRound(3)).toBe("across");
    expect(passDirectionForRound(4)).toBe("hold");
    expect(passDirectionForRound(5)).toBe("left");
  });
});

describe("passTarget", () => {
  test("left: i → i+1 mod 4", () => {
    expect(passTarget(0, "left")).toBe(1 as PlayerIndex);
    expect(passTarget(3, "left")).toBe(0 as PlayerIndex);
  });
  test("right: i → i-1 mod 4", () => {
    expect(passTarget(0, "right")).toBe(3 as PlayerIndex);
    expect(passTarget(2, "right")).toBe(1 as PlayerIndex);
  });
  test("across: i → i+2 mod 4", () => {
    expect(passTarget(0, "across")).toBe(2 as PlayerIndex);
    expect(passTarget(1, "across")).toBe(3 as PlayerIndex);
  });
  test("hold returns null", () => {
    expect(passTarget(0, "hold")).toBeNull();
  });
});

describe("HeartsGame.executePass", () => {
  test("exchanges 3 cards left", () => {
    const game = new HeartsGame();
    const before = game.getState().hands.map((h) => h.map(cardKey));

    for (let p = 0; p < 4; p++) {
      game.selectPass(p as PlayerIndex, [0, 1, 2]);
    }
    game.executePass();

    const after = game.getState().hands.map((h) => h.map(cardKey));
    expect(after.flat()).toHaveLength(52);
    expect(new Set(after.flat()).size).toBe(52);

    for (let p = 0; p < 4; p++) {
      const passed = before[p]!.slice(0, 3);
      const target = (p + 1) % 4;
      passed.forEach((k) => {
        expect(after[target]).toContain(k);
      });
    }
    expect(game.getState().phase).toBe("PLAYING");
  });

  test("hold round skips pass and goes straight to PLAYING", () => {
    const game = new HeartsGame();
    while (game.getState().roundNumber < 4) {
      game.selectBotPasses();
      game.selectPass(0, [0, 1, 2]);
      game.executePass();
      while (game.getState().phase === "PLAYING") {
        if (game.getState().currentTurn === 0) {
          const legals = game.legalPlaysFor(0);
          game.playCard(0, legals[0]!);
        } else {
          game.botPlay();
        }
      }
      if (game.getState().phase === "ROUND_OVER") game.nextRound();
      else break;
    }
    if (game.getState().roundNumber === 4) {
      expect(game.getState().phase).toBe("PLAYING");
    }
  });
});

describe("HeartsGame full round", () => {
  test("first trick is led by holder of 2♣ with 2♣", () => {
    const game = new HeartsGame();
    game.selectBotPasses();
    game.selectPass(0, [0, 1, 2]);
    game.executePass();
    const state = game.getState();
    const leader = state.currentTrick!.leader;
    const holderHas2c = state.hands[leader]!.some(isTwoOfClubs);
    expect(holderHas2c).toBe(true);

    if (leader !== 0) {
      // bots play down to player 0; the very first play must be 2♣
      const card = game.botPlay();
      expect(card?.suit).toBe(Suit.Clubs);
      expect(card?.cardName).toBe(CardName.Two);
    }
  });

  test("playing all 13 tricks completes the round and assigns scores", () => {
    const game = new HeartsGame();
    game.selectBotPasses();
    const hand0 = game.getState().hands[0]!;
    const idxs = [0, 1, 2].filter((i) => i < hand0.length);
    game.selectPass(0, idxs);
    game.executePass();

    let safety = 200;
    while (game.getState().phase === "PLAYING" && safety-- > 0) {
      if (game.getState().currentTurn === 0) {
        const legals = game.legalPlaysFor(0);
        game.playCard(0, legals[0]!);
      } else {
        game.botPlay();
      }
    }
    expect(safety).toBeGreaterThan(0);
    const state = game.getState();
    expect(["ROUND_OVER", "GAME_OVER"]).toContain(state.phase);
    const total = state.scores.reduce((s, n) => s + n, 0);
    expect(total).toBe(26);
  });
});
