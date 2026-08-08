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

describe("500 rum", () => {
  test("preset config: points scoring to 500, deep pickup, ace-high runs, no Q♠ bonus", () => {
    const cfg = new RummyGame("500-rum", 1).getConfig();
    expect(cfg.scoring).toBe("points-500");
    expect(cfg.targetScore).toBe(500);
    expect(cfg.discardPickup).toBe("any");
    expect(cfg.runOptions).toEqual({ aceHigh: true, roundTheCorner: false });
    expect(cfg.spadeQueenBonus).toBe(false);
    expect(cfg.meldsOnTable).toBe(true);
    expect(cfg.layOffAllowed).toBe(true);
  });

  test("deep pickup takes the buried card and everything above it", () => {
    const game = new RummyGame("500-rum", 1);
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [
      card(CardName.Two, Suit.Clubs),
      card(CardName.Seven, Suit.Spades),
      card(CardName.King, Suit.Diamonds),
      card(CardName.Four, Suit.Hearts),
    ];
    s.playerHand = [
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
      card(CardName.Nine, Suit.Clubs),
    ];

    expect(game.playerDrawFromDiscard(1)).toBe(true);
    expect(s.playerHand.length).toBe(6); // took 7♠, K♦, 4♥
    expect(s.discardPile.length).toBe(1);
    expect(s.discardPile[0]!.cardName).toBe(CardName.Two);
    expect(s.mustMeld).not.toBeNull();
    expect(s.mustMeld!.cardName).toBe(CardName.Seven);
    expect(s.mustMeld!.suit).toBe(Suit.Spades);
    expect(s.phase).toBe("PLAYER_MELD");
  });

  test("the taken buried card must be melded before discarding", () => {
    const game = new RummyGame("500-rum", 1);
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [
      card(CardName.Two, Suit.Clubs),
      card(CardName.Seven, Suit.Spades),
      card(CardName.Four, Suit.Hearts),
    ];
    s.playerHand = [
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
      card(CardName.Nine, Suit.Clubs),
    ];
    expect(game.playerDrawFromDiscard(1)).toBe(true);

    // Discard is blocked while the 7♠ sits unmelded.
    expect(game.discardBlocked()).toBe(true);
    expect(
      game.playerDiscard(idxOf(s.playerHand, CardName.Nine, Suit.Clubs)),
    ).toBe(false);

    const sevens = [
      idxOf(s.playerHand, CardName.Seven, Suit.Spades),
      idxOf(s.playerHand, CardName.Seven, Suit.Hearts),
      idxOf(s.playerHand, CardName.Seven, Suit.Diamonds),
    ];
    expect(game.playerMeld(sevens)).toBe(true);
    expect(s.mustMeld).toBeNull();
    expect(
      game.playerDiscard(idxOf(s.playerHand, CardName.Nine, Suit.Clubs)),
    ).toBe(true);
    expect(s.phase).toBe("BOT_TURN");
  });

  test("a buried card that cannot be used immediately cannot be taken", () => {
    const game = new RummyGame("500-rum", 1);
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.discardPile = [
      card(CardName.Two, Suit.Clubs),
      card(CardName.King, Suit.Diamonds),
      card(CardName.Four, Suit.Hearts),
    ];
    s.playerHand = [
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Nine, Suit.Clubs),
      card(CardName.Jack, Suit.Spades),
    ];
    s.tableMelds = [];

    expect(game.playerDrawFromDiscard(1)).toBe(false);
    expect(s.discardPile.length).toBe(3);
    expect(s.playerHand.length).toBe(3);
    expect(s.phase).toBe("PLAYER_TURN");
  });

  test("melded cards score for the layer: aces 15 in sets, 1 in low runs, 15 ace-high", () => {
    const game = new RummyGame("500-rum", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.Ace, Suit.Spades),
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Ace, Suit.Diamonds),
      card(CardName.Ace, Suit.Clubs),
      card(CardName.Two, Suit.Clubs),
      card(CardName.Three, Suit.Clubs),
      card(CardName.Queen, Suit.Hearts),
      card(CardName.King, Suit.Hearts),
      card(CardName.Nine, Suit.Clubs),
    ];

    // A♠ A♥ A♦ set → 45.
    expect(game.playerMeld([0, 1, 2])).toBe(true);
    expect(s.meldPoints.player).toBe(45);

    // A♣ 2♣ 3♣ low run → 1 + 2 + 3 = 6.
    expect(
      game.playerMeld([
        idxOf(s.playerHand, CardName.Ace, Suit.Clubs),
        idxOf(s.playerHand, CardName.Two, Suit.Clubs),
        idxOf(s.playerHand, CardName.Three, Suit.Clubs),
      ]),
    ).toBe(true);
    expect(s.meldPoints.player).toBe(45 + 6);
  });

  test("ace-high run Q-K-A scores the ace at 15; Q♠ is plain 10 here", () => {
    const game = new RummyGame("500-rum", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.Queen, Suit.Spades),
      card(CardName.King, Suit.Spades),
      card(CardName.Ace, Suit.Spades),
      card(CardName.Nine, Suit.Clubs),
    ];
    expect(game.playerMeld([0, 1, 2])).toBe(true);
    expect(s.meldPoints.player).toBe(10 + 10 + 15); // no spade-queen bonus
  });

  test("lay-offs credit the layer, not the meld owner", () => {
    const game = new RummyGame("500-rum", 1);
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
    s.meldPoints = { player: 0, computer: 15 };
    s.playerHand = [
      card(CardName.Seven, Suit.Spades),
      card(CardName.Nine, Suit.Hearts),
    ];

    expect(game.playerLayOff(0, 0)).toBe(true);
    expect(s.meldPoints.player).toBe(7);
    expect(s.meldPoints.computer).toBe(15);
    expect(s.tableMelds[0]!.owner).toBe("computer");
  });

  test("settlement: laid points count for you, hand cards count against you", () => {
    const game = new RummyGame("500-rum", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.meldPoints = { player: 30, computer: 10 };
    s.playerHand = [card(CardName.Three, Suit.Clubs)];
    s.computerHand = [
      card(CardName.King, Suit.Diamonds),
      card(CardName.Ace, Suit.Hearts), // aces left in hand count 15 against
    ];

    expect(game.playerDiscard(0)).toBe(true);
    expect(s.phase).toBe("ROUND_OVER");
    expect(s.roundDeltas).toEqual({ player: 30, computer: 10 - 25 });
    expect(s.playerScore).toBe(30);
    expect(s.computerScore).toBe(-15);
    expect(s.roundWinner).toBe("player");
  });

  test("stock exhaustion settles both nets without anyone going out", () => {
    const game = new RummyGame("500-rum", 1);
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.stock = [];
    s.reshuffles = 1;
    s.discardPile = [card(CardName.Nine, Suit.Spades)];
    s.meldPoints = { player: 20, computer: 40 };
    s.playerHand = [card(CardName.Five, Suit.Clubs)]; // −5
    s.computerHand = [card(CardName.Six, Suit.Clubs)]; // −6

    expect(game.playerDrawFromStock()).toBe(true);
    expect(s.phase).toBe("ROUND_OVER");
    expect(s.roundDeltas).toEqual({ player: 15, computer: 34 });
    expect(s.roundWinner).toBe("computer");
  });
});
