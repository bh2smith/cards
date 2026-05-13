import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { GinRummyGame } from "../game";
import type { GinState } from "../types";
import { cardKey } from "../../../shared/deck";

function card(rank: CardName, suit: Suit = Suit.Spades): PlayingCard {
  return new PlayingCard(rank, suit);
}

describe("GinRummyGame", () => {
  describe("deal", () => {
    test("each player gets 10 cards", () => {
      const game = new GinRummyGame();
      const state = game.getState();
      expect(state.playerHand.length).toBe(10);
      expect(state.computerHand.length).toBe(10);
    });

    test("discard pile starts with 1 card", () => {
      const game = new GinRummyGame();
      expect(game.getState().discardPile.length).toBe(1);
    });

    test("stock has 31 cards (52 - 10 - 10 - 1)", () => {
      const game = new GinRummyGame();
      expect(game.getState().stock.length).toBe(31);
    });

    test("no duplicate cards across all locations", () => {
      const game = new GinRummyGame();
      const state = game.getState();
      const allCards = [
        ...state.playerHand,
        ...state.computerHand,
        ...state.stock,
        ...state.discardPile,
      ];
      expect(allCards.length).toBe(52);
      const keys = new Set(allCards.map(cardKey));
      expect(keys.size).toBe(52);
    });

    test("initial phase is DRAWING", () => {
      const game = new GinRummyGame();
      expect(game.getState().phase).toBe("DRAWING");
    });

    test("non-dealer goes first (computer is default dealer)", () => {
      const game = new GinRummyGame();
      expect(game.getState().dealer).toBe("computer");
      expect(game.getState().currentTurn).toBe("player");
    });
  });

  describe("playerDrawFromStock", () => {
    test("adds a card to player hand and moves to DISCARDING", () => {
      const game = new GinRummyGame();
      const stockBefore = game.getState().stock.length;
      game.playerDrawFromStock();
      expect(game.getState().playerHand.length).toBe(11);
      expect(game.getState().stock.length).toBe(stockBefore - 1);
      expect(game.getState().phase).toBe("DISCARDING");
    });

    test("does nothing when not in DRAWING phase", () => {
      const game = new GinRummyGame();
      game.playerDrawFromStock();
      game.playerDrawFromStock(); // should be no-op (now DISCARDING)
      expect(game.getState().playerHand.length).toBe(11);
    });
  });

  describe("playerDrawFromDiscard", () => {
    test("takes top of discard pile", () => {
      const game = new GinRummyGame();
      const discardTop =
        game.getState().discardPile[game.getState().discardPile.length - 1]!;
      game.playerDrawFromDiscard();
      const hand = game.getState().playerHand;
      expect(hand.length).toBe(11);
      expect(hand.some((c) => cardKey(c) === cardKey(discardTop))).toBe(true);
      expect(game.getState().discardPile.length).toBe(0);
    });
  });

  describe("playerDiscard", () => {
    test("moves card from hand to discard pile", () => {
      const game = new GinRummyGame();
      game.playerDrawFromStock();
      expect(game.getState().playerHand.length).toBe(11);

      const discardBefore = game.getState().discardPile.length;
      game.playerDiscard(0);

      expect(game.getState().playerHand.length).toBe(10);
      expect(game.getState().discardPile.length).toBe(discardBefore + 1);
      expect(game.getState().phase).toBe("BOT_TURN");
      expect(game.getState().currentTurn).toBe("computer");
    });

    test("does nothing with invalid index", () => {
      const game = new GinRummyGame();
      game.playerDrawFromStock();
      game.playerDiscard(-1);
      expect(game.getState().playerHand.length).toBe(11);
    });
  });

  describe("botTurn", () => {
    test("bot draws, discards, and passes turn back", () => {
      const game = new GinRummyGame();
      game.playerDrawFromStock();
      game.playerDiscard(0);

      expect(game.getState().phase).toBe("BOT_TURN");
      const result = game.botTurn();

      expect(["stock", "discard"]).toContain(result.drewFrom);
      expect(result.discardedCard).toBeDefined();
      if (!result.knocked) {
        expect(game.getState().currentTurn).toBe("player");
        expect(game.getState().phase).toBe("DRAWING");
        expect(game.getState().computerHand.length).toBe(10);
      }
    });

    test("throws when not bot turn", () => {
      const game = new GinRummyGame();
      expect(() => game.botTurn()).toThrow("Not bot's turn");
    });
  });

  describe("scoring", () => {
    test("scores start at 0", () => {
      const game = new GinRummyGame();
      expect(game.getState().playerScore).toBe(0);
      expect(game.getState().computerScore).toBe(0);
    });

    test("scores never go negative after a round", () => {
      for (let i = 0; i < 20; i++) {
        const game = new GinRummyGame();
        let turns = 0;
        while (turns < 200) {
          const state = game.getState();
          if (state.phase === "ROUND_OVER" || state.phase === "GAME_OVER")
            break;
          if (state.phase === "DRAWING" && state.currentTurn === "player") {
            game.playerDrawFromStock();
          } else if (
            state.phase === "DISCARDING" &&
            state.currentTurn === "player"
          ) {
            game.playerDiscard(0);
          } else if (state.phase === "BOT_TURN") {
            game.botTurn();
          }
          turns++;
        }
        const final = game.getState();
        expect(final.playerScore).toBeGreaterThanOrEqual(0);
        expect(final.computerScore).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("nextRound", () => {
    test("swaps dealer and deals fresh hands", () => {
      const game = new GinRummyGame();
      expect(game.getState().dealer).toBe("computer");
      game.nextRound();
      expect(game.getState().dealer).toBe("player");
      expect(game.getState().playerHand.length).toBe(10);
      expect(game.getState().computerHand.length).toBe(10);
      expect(game.getState().currentTurn).toBe("computer");
    });
  });

  describe("canPlayerKnock", () => {
    test("returns false when not in DISCARDING phase", () => {
      const game = new GinRummyGame();
      expect(game.canPlayerKnock()).toBe(false);
    });
  });

  describe("full round flow", () => {
    test("can play through a complete round without errors", () => {
      const game = new GinRummyGame();
      let turns = 0;
      const maxTurns = 200;

      while (turns < maxTurns) {
        const state = game.getState();
        if (state.phase === "ROUND_OVER" || state.phase === "GAME_OVER") break;

        if (state.phase === "DRAWING" && state.currentTurn === "player") {
          game.playerDrawFromStock();
        } else if (
          state.phase === "DISCARDING" &&
          state.currentTurn === "player"
        ) {
          game.playerDiscard(0);
        } else if (state.phase === "BOT_TURN") {
          game.botTurn();
        }
        turns++;
      }

      expect(turns).toBeLessThan(maxTurns);
    });
  });
});
