import { test, expect, describe } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import { RummyGame } from "../game";
import type { RummyState } from "../types";
import { createDeck } from "../../../shared/deck";

const DECK = createDeck();
const card = (name: CardName, suit: Suit): PlayingCard =>
  DECK.find((c) => c.cardName === name && c.suit === suit)!;

function mut(game: RummyGame): RummyState {
  return game.getState() as RummyState;
}

function idxOf(hand: PlayingCard[], name: CardName, suit: Suit): number {
  return hand.findIndex((c) => c.cardName === name && c.suit === suit);
}

describe("straight rummy", () => {
  test("base config: melds on table, lay-offs, shed scoring to 100", () => {
    const cfg = new RummyGame(undefined, 1).getConfig();
    expect(cfg.meldsOnTable).toBe(true);
    expect(cfg.layOffAllowed).toBe(true);
    expect(cfg.knock).toBeNull();
    expect(cfg.scoring).toBe("shed");
    expect(cfg.targetScore).toBe(100);
    expect(cfg.discardPickup).toBe("top");
    expect(cfg.runOptions).toEqual({ aceHigh: false, roundTheCorner: false });
  });

  test("laying a valid set moves it to the table with owner tag", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.Seven, Suit.Spades),
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
      card(CardName.Two, Suit.Clubs),
    ];

    expect(game.playerMeld([0, 1, 2])).toBe(true);
    expect(s.tableMelds.length).toBe(1);
    expect(s.tableMelds[0]!.owner).toBe("player");
    expect(s.tableMelds[0]!.type).toBe("set");
    expect(s.playerHand.length).toBe(1);
  });

  test("an invalid meld selection is rejected", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.Seven, Suit.Spades),
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Nine, Suit.Diamonds),
    ];
    expect(game.playerMeld([0, 1, 2])).toBe(false);
    expect(s.tableMelds.length).toBe(0);
  });

  test("laying off extends an opponent's table run", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.tableMelds = [
      {
        owner: "computer",
        type: "run",
        cards: [
          card(CardName.Four, Suit.Spades),
          card(CardName.Five, Suit.Spades),
          card(CardName.Six, Suit.Spades),
        ],
      },
    ];
    s.playerHand = [
      card(CardName.Seven, Suit.Spades),
      card(CardName.Nine, Suit.Hearts),
    ];

    expect(game.layOffTargetsFor(0)).toEqual([0]);
    expect(game.layOffTargetsFor(1)).toEqual([]);
    expect(game.playerLayOff(0, 0)).toBe(true);
    expect(s.tableMelds[0]!.cards.length).toBe(4);
    expect(s.tableMelds[0]!.owner).toBe("computer");
    expect(s.playerHand.length).toBe(1);
  });

  test("ace-high lay-off is rejected when aces are low", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.tableMelds = [
      {
        owner: "player",
        type: "run",
        cards: [
          card(CardName.Jack, Suit.Spades),
          card(CardName.Queen, Suit.Spades),
          card(CardName.King, Suit.Spades),
        ],
      },
    ];
    s.playerHand = [card(CardName.Ace, Suit.Spades)];
    expect(game.playerLayOff(0, 0)).toBe(false);
  });

  test("going out by discarding the last card sheds the opponent's hand pips", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [card(CardName.Two, Suit.Clubs)];
    s.computerHand = [
      card(CardName.King, Suit.Diamonds),
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Five, Suit.Spades),
    ]; // 10 + 1 + 5 = 16

    expect(game.playerDiscard(0)).toBe(true);
    expect(s.phase).toBe("ROUND_OVER");
    expect(s.roundWinner).toBe("player");
    expect(s.roundPoints).toBe(16);
    expect(s.playerScore).toBe(16);
    expect(s.computerScore).toBe(0);
  });

  test("going out by melding the whole hand (no discard) also ends the round", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.Seven, Suit.Spades),
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
    ];
    s.computerHand = [card(CardName.Nine, Suit.Clubs)];

    expect(game.playerMeld([0, 1, 2])).toBe(true);
    expect(s.phase).toBe("ROUND_OVER");
    expect(s.roundWinner).toBe("player");
    expect(s.roundPoints).toBe(9);
  });

  test("reaching the target score ends the game", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerScore = 95;
    s.playerHand = [card(CardName.Two, Suit.Clubs)];
    s.computerHand = [card(CardName.King, Suit.Diamonds)];

    game.playerDiscard(0);
    expect(s.phase).toBe("GAME_OVER");
    expect(s.winner).toBe("player");
  });

  test("player cannot act out of phase", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    const handBefore = s.playerHand.length;
    expect(game.playerDiscard(0)).toBe(false);
    expect(game.playerMeld([0, 1, 2])).toBe(false);
    expect(s.playerHand.length).toBe(handBefore);

    expect(game.playerDrawFromStock()).toBe(true);
    expect(s.phase).toBe("PLAYER_MELD");
    expect(game.playerDrawFromStock()).toBe(false); // already drew
  });

  test("deal: 10 cards each, one upcard, 31 in stock", () => {
    const s = new RummyGame(undefined, 7).getState();
    expect(s.playerHand.length).toBe(10);
    expect(s.computerHand.length).toBe(10);
    expect(s.discardPile.length).toBe(1);
    expect(s.stock.length).toBe(31);
  });
});

describe("straight rummy: stock exhaustion", () => {
  test("second exhaustion settles the hand for the lower pip count", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.stock = [];
    s.discardPile = [card(CardName.Nine, Suit.Clubs)];
    s.reshuffles = 1;
    s.tableMelds = [];
    s.playerHand = [card(CardName.Two, Suit.Clubs)]; // 2
    s.computerHand = [card(CardName.King, Suit.Diamonds)]; // 10

    expect(game.playerDrawFromStock()).toBe(true);
    expect(s.phase).toBe("ROUND_OVER");
    expect(s.roundWinner).toBe("player");
    expect(s.roundPoints).toBe(8);
  });

  test("first exhaustion reshuffles the discard, keeping the top card", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.stock = [];
    s.discardPile = [
      card(CardName.Nine, Suit.Clubs),
      card(CardName.Ten, Suit.Clubs),
      card(CardName.Jack, Suit.Clubs),
    ];

    const handBefore = s.playerHand.length;
    expect(game.playerDrawFromStock()).toBe(true);
    expect(s.playerHand.length).toBe(handBefore + 1);
    expect(s.reshuffles).toBe(1);
    expect(s.discardPile.length).toBe(1);
    expect(s.discardPile[0]!.cardName).toBe(CardName.Jack);
    expect(s.stock.length).toBe(1);
  });
});

describe("straight rummy: helpers", () => {
  test("isValidMeldSelection matches classify rules", () => {
    const game = new RummyGame(undefined, 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.Four, Suit.Hearts),
      card(CardName.Five, Suit.Hearts),
      card(CardName.Six, Suit.Hearts),
      card(CardName.Six, Suit.Clubs),
    ];
    expect(game.isValidMeldSelection([0, 1, 2])).toBe(true);
    expect(game.isValidMeldSelection([0, 1, 3])).toBe(false);
    expect(game.isValidMeldSelection([0, 1])).toBe(false);
  });

  test("idxOf helper sanity", () => {
    const hand = [card(CardName.Four, Suit.Hearts)];
    expect(idxOf(hand, CardName.Four, Suit.Hearts)).toBe(0);
  });
});
