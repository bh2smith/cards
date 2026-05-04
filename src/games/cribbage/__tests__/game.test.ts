import { test, expect, describe } from "bun:test";
import { CribbageGame } from "../game";

describe("CribbageGame", () => {
  test("starts in NEW_GAME phase", () => {
    const game = new CribbageGame();
    expect(game.getState().phase).toBe("NEW_GAME");
  });

  test("deal transitions to DISCARDING with 6 cards each", () => {
    const game = new CribbageGame();
    game.deal();
    const state = game.getState();
    expect(state.phase).toBe("DISCARDING");
    expect(state.playerHand.length).toBe(6);
    expect(state.computerHand.length).toBe(6);
  });

  test("discard moves 2 cards from each player to crib", () => {
    const game = new CribbageGame();
    game.deal();
    game.playerDiscard([0, 1]);
    const state = game.getState();
    expect(state.phase).toBe("CUTTING");
    expect(state.playerHand.length).toBe(4);
    expect(state.computerHand.length).toBe(4);
    expect(state.crib.length).toBe(4);
  });

  test("cut reveals starter and transitions to PEGGING", () => {
    const game = new CribbageGame();
    game.deal();
    game.playerDiscard([0, 1]);
    game.cut();
    const state = game.getState();
    expect(state.phase).toBe("PEGGING");
    expect(state.starterCard).not.toBeNull();
    expect(state.playerPeggingHand.length).toBe(4);
    expect(state.computerPeggingHand.length).toBe(4);
  });

  test("non-dealer plays first in pegging", () => {
    const game = new CribbageGame();
    game.deal();
    game.playerDiscard([0, 1]);
    game.cut();
    const state = game.getState();
    const expected = state.dealer === "player" ? "computer" : "player";
    expect(state.currentTurn).toBe(expected);
  });

  test("newGame resets all state", () => {
    const game = new CribbageGame();
    game.deal();
    game.playerDiscard([0, 1]);
    game.cut();
    game.newGame();
    const state = game.getState();
    expect(state.phase).toBe("DISCARDING");
    expect(state.playerScore).toBe(0);
    expect(state.computerScore).toBe(0);
    expect(state.playerHand.length).toBe(6);
  });

  test("full round flows through all phases", () => {
    const game = new CribbageGame();
    game.deal();
    game.playerDiscard([0, 1]);
    game.cut();

    // Play through pegging
    while (!game.isPeggingDone()) {
      const state = game.getState();
      if (state.phase === "GAME_OVER") break;

      if (state.currentTurn === "computer") {
        game.computerPlay();
      } else {
        const playable = state.playerPeggingHand.filter(
          (c) => Math.min(c.cardName + 1, 10) + state.peggingCount <= 31,
        );
        if (playable.length > 0) {
          game.playerPlayPeggingCard(playable[0]);
        } else {
          game.playerGo();
        }
      }
    }

    if (game.getState().phase === "GAME_OVER") return;

    game.awardLastCard();
    game.startCounting();
    expect(game.getState().phase).toBe("COUNTING_NONDEALER");

    game.scoreCurrentPhaseHand();
    game.advanceCounting();
    if (game.getState().phase === "GAME_OVER") return;
    expect(game.getState().phase).toBe("COUNTING_DEALER");

    game.scoreCurrentPhaseHand();
    game.advanceCounting();
    if (game.getState().phase === "GAME_OVER") return;
    expect(game.getState().phase).toBe("COUNTING_CRIB");

    game.scoreCurrentPhaseHand();
    game.advanceCounting();
    if (game.getState().phase === "GAME_OVER") return;
    expect(game.getState().phase).toBe("ROUND_OVER");
  });

  test("dealer alternates between rounds", () => {
    const game = new CribbageGame();
    game.deal();
    const firstDealer = game.getState().dealer;
    game.playerDiscard([0, 1]);
    game.cut();

    // Fast-forward through pegging
    while (!game.isPeggingDone()) {
      const state = game.getState();
      if (state.phase === "GAME_OVER") return;
      if (state.currentTurn === "computer") {
        game.computerPlay();
      } else {
        const playable = state.playerPeggingHand.filter(
          (c) => Math.min(c.cardName + 1, 10) + state.peggingCount <= 31,
        );
        if (playable.length > 0) {
          game.playerPlayPeggingCard(playable[0]);
        } else {
          game.playerGo();
        }
      }
    }
    if (game.getState().phase === "GAME_OVER") return;

    game.awardLastCard();
    game.startCounting();
    game.scoreCurrentPhaseHand();
    game.advanceCounting();
    if (game.getState().phase === "GAME_OVER") return;
    game.scoreCurrentPhaseHand();
    game.advanceCounting();
    if (game.getState().phase === "GAME_OVER") return;
    game.scoreCurrentPhaseHand();
    game.advanceCounting();
    if (game.getState().phase === "GAME_OVER") return;

    game.nextRound();
    const secondDealer = game.getState().dealer;
    expect(secondDealer).not.toBe(firstDealer);
  });
});
