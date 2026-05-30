import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { CrazyEightsGame } from "../game";
import {
  type CrazyEightsState,
  cardValue,
  handValue,
  isLegalPlay,
  WINNING_SCORE,
} from "../types";
import { cardKey } from "../../../shared/deck";

function card(rank: CardName, suit: Suit = Suit.Spades): PlayingCard {
  return new PlayingCard(rank, suit);
}

/** The live, mutable state object (getState returns the real reference). */
function mut(game: CrazyEightsGame): CrazyEightsState {
  return game.getState() as CrazyEightsState;
}

describe("card values", () => {
  test("eights are worth 50", () => {
    expect(cardValue(card(CardName.Eight))).toBe(50);
  });

  test("ten and face cards are worth 10", () => {
    expect(cardValue(card(CardName.Ten))).toBe(10);
    expect(cardValue(card(CardName.Jack))).toBe(10);
    expect(cardValue(card(CardName.King))).toBe(10);
  });

  test("ace is worth 1, pips are face value", () => {
    expect(cardValue(card(CardName.Ace))).toBe(1);
    expect(cardValue(card(CardName.Five))).toBe(5);
  });

  test("handValue sums penalties", () => {
    const hand = [
      card(CardName.Eight),
      card(CardName.King),
      card(CardName.Three),
    ];
    expect(handValue(hand)).toBe(63);
  });
});

describe("isLegalPlay", () => {
  test("eights are always legal", () => {
    expect(
      isLegalPlay(card(CardName.Eight, Suit.Hearts), Suit.Clubs, CardName.Two),
    ).toBe(true);
  });

  test("matching suit is legal", () => {
    expect(
      isLegalPlay(card(CardName.Three, Suit.Clubs), Suit.Clubs, CardName.Nine),
    ).toBe(true);
  });

  test("matching rank is legal", () => {
    expect(
      isLegalPlay(card(CardName.Nine, Suit.Hearts), Suit.Clubs, CardName.Nine),
    ).toBe(true);
  });

  test("non-matching card is illegal", () => {
    expect(
      isLegalPlay(card(CardName.Two, Suit.Hearts), Suit.Clubs, CardName.Nine),
    ).toBe(false);
  });
});

describe("deal", () => {
  test("each player gets 7 cards", () => {
    const state = new CrazyEightsGame().getState();
    expect(state.playerHand.length).toBe(7);
    expect(state.computerHand.length).toBe(7);
  });

  test("one card on the discard, rest in stock (52 - 7 - 7 - 1 = 37)", () => {
    const state = new CrazyEightsGame().getState();
    expect(state.discardPile.length).toBe(1);
    expect(state.stock.length).toBe(37);
  });

  test("no duplicate cards across all locations", () => {
    const state = new CrazyEightsGame().getState();
    const all = [
      ...state.playerHand,
      ...state.computerHand,
      ...state.stock,
      ...state.discardPile,
    ];
    expect(all.length).toBe(52);
    expect(new Set(all.map(cardKey)).size).toBe(52);
  });

  test("starter is never an eight", () => {
    for (let i = 0; i < 60; i++) {
      const state = new CrazyEightsGame().getState();
      expect(state.discardPile[0]!.cardName).not.toBe(CardName.Eight);
    }
  });

  test("active suit starts as the starter's suit", () => {
    const state = new CrazyEightsGame().getState();
    expect(state.activeSuit).toBe(state.discardPile[0]!.suit);
  });

  test("non-dealer leads (computer is default dealer)", () => {
    const state = new CrazyEightsGame().getState();
    expect(state.dealer).toBe("computer");
    expect(state.currentTurn).toBe("player");
  });
});

describe("playerPlay", () => {
  test("plays a matching card and passes to the computer", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.playerHand = [
      card(CardName.Five, Suit.Hearts),
      card(CardName.King, Suit.Diamonds),
    ];

    expect(game.playerPlay(0)).toBe(true);
    expect(game.getState().phase).toBe("BOT_TURN");
    expect(game.getState().activeSuit).toBe(Suit.Hearts);
    expect(game.getState().playerHand.length).toBe(1);
  });

  test("rejects an illegal play", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.playerHand = [card(CardName.King, Suit.Diamonds)];

    expect(game.playerPlay(0)).toBe(false);
    expect(game.getState().phase).toBe("PLAYER_TURN");
  });

  test("playing an eight asks for a suit, then applies it", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.playerHand = [card(CardName.Eight, Suit.Hearts), card(CardName.King)];

    game.playerPlay(0);
    expect(game.getState().phase).toBe("CHOOSE_SUIT");

    game.playerChooseSuit(Suit.Diamonds);
    expect(game.getState().phase).toBe("BOT_TURN");
    expect(game.getState().activeSuit).toBe(Suit.Diamonds);
  });

  test("emptying the hand wins the round and scores opponent's hand", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.playerHand = [card(CardName.Five, Suit.Hearts)];
    s.computerHand = [card(CardName.King), card(CardName.Two)]; // 10 + 2 = 12

    game.playerPlay(0);
    const out = game.getState();
    expect(out.phase).toBe("ROUND_OVER");
    expect(out.roundWinner).toBe("player");
    expect(out.playerScore).toBe(12);
  });

  test("going out on an eight wins immediately without a suit choice", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.playerHand = [card(CardName.Eight, Suit.Hearts)];
    s.computerHand = [card(CardName.Three)];

    game.playerPlay(0);
    expect(game.getState().phase).toBe("ROUND_OVER");
    expect(game.getState().roundWinner).toBe("player");
  });
});

describe("playerDraw", () => {
  test("draws a card when no legal play exists", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.playerHand = [card(CardName.King, Suit.Diamonds)];
    s.stock = [card(CardName.Two, Suit.Hearts)];

    expect(game.canPlayerDraw()).toBe(true);
    game.playerDraw();
    expect(game.getState().playerHand.length).toBe(2);
    expect(game.getState().stock.length).toBe(0);
  });

  test("cannot draw when a legal play is available", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.playerHand = [card(CardName.Five, Suit.Hearts)];
    expect(game.canPlayerDraw()).toBe(false);
  });

  test("passes to the computer when the stock is exhausted", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.playerHand = [card(CardName.King, Suit.Diamonds)];
    s.stock = [];

    game.playerDraw();
    expect(game.getState().consecutivePasses).toBe(1);
    expect(game.getState().currentTurn).toBe("computer");
    expect(game.getState().phase).toBe("BOT_TURN");
  });
});

describe("botTurn", () => {
  test("plays a legal card and hands turn back to the player", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "BOT_TURN";
    s.currentTurn = "computer";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.computerHand = [
      card(CardName.Five, Suit.Hearts),
      card(CardName.Two, Suit.Spades),
    ];
    s.playerHand = [card(CardName.King)];

    const move = game.botTurn();
    expect(move.playedCard).not.toBeNull();
    expect(game.getState().phase).toBe("PLAYER_TURN");
    expect(game.getState().computerHand.length).toBe(1);
  });

  test("draws until it can play", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "BOT_TURN";
    s.currentTurn = "computer";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.computerHand = [card(CardName.King, Suit.Diamonds)];
    // First draw is unplayable, second matches clubs.
    s.stock = [
      card(CardName.Five, Suit.Clubs),
      card(CardName.Two, Suit.Hearts),
    ];

    const move = game.botTurn();
    expect(move.drewCount).toBe(2);
    expect(move.playedCard?.suit).toBe(Suit.Clubs);
  });

  test("passes when blocked with an empty stock", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "BOT_TURN";
    s.currentTurn = "computer";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.computerHand = [card(CardName.King, Suit.Diamonds)];
    s.playerHand = [card(CardName.Queen, Suit.Diamonds)];
    s.stock = [];

    const move = game.botTurn();
    expect(move.passed).toBe(true);
    expect(game.getState().consecutivePasses).toBe(1);
  });
});

describe("blocked round", () => {
  test("two passes in a row end the round, lower hand value wins", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.stock = [];
    s.playerHand = [card(CardName.Two, Suit.Diamonds)]; // value 2
    s.computerHand = [card(CardName.King, Suit.Diamonds)]; // value 10
    s.consecutivePasses = 1; // computer already passed

    game.playerDraw(); // player can't play, stock empty -> 2nd pass
    const out = game.getState();
    expect(out.phase).toBe("ROUND_OVER");
    expect(out.roundWinner).toBe("player");
    expect(out.playerScore).toBe(8); // 10 - 2
  });
});

describe("game over", () => {
  test("reaching the target score ends the game", () => {
    const game = new CrazyEightsGame();
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.playerScore = WINNING_SCORE - 5;
    s.discardPile = [card(CardName.Five, Suit.Clubs)];
    s.activeSuit = Suit.Clubs;
    s.playerHand = [card(CardName.Five, Suit.Hearts)];
    s.computerHand = [card(CardName.King), card(CardName.King)]; // 20

    game.playerPlay(0);
    expect(game.getState().phase).toBe("GAME_OVER");
    expect(game.getState().winner).toBe("player");
  });
});
