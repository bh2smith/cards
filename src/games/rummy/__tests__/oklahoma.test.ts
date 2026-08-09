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

describe("oklahoma rum", () => {
  test("preset config: 500 rum rules plus the spade-queen bonus", () => {
    const cfg = new RummyGame("oklahoma-rum", 1).getConfig();
    expect(cfg.scoring).toBe("points-500");
    expect(cfg.targetScore).toBe(500);
    expect(cfg.discardPickup).toBe("any");
    expect(cfg.runOptions).toEqual({ aceHigh: true, roundTheCorner: false });
    expect(cfg.spadeQueenBonus).toBe(true);
  });

  test("melding the Q♠ scores 50 while other queens stay at 10", () => {
    const game = new RummyGame("oklahoma-rum", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.Queen, Suit.Spades),
      card(CardName.Queen, Suit.Hearts),
      card(CardName.Queen, Suit.Diamonds),
      card(CardName.Nine, Suit.Clubs),
    ];

    expect(game.playerMeld([0, 1, 2])).toBe(true);
    expect(s.meldPoints.player).toBe(50 + 10 + 10);
  });

  test("the Q♠ left in hand counts 50 against at settlement", () => {
    const game = new RummyGame("oklahoma-rum", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.meldPoints = { player: 5, computer: 0 };
    s.playerHand = [card(CardName.Three, Suit.Clubs)];
    s.computerHand = [card(CardName.Queen, Suit.Spades)];

    expect(game.playerDiscard(0)).toBe(true);
    expect(s.roundDeltas).toEqual({ player: 5, computer: -50 });
  });

  test("laying the Q♠ off also earns the bonus", () => {
    const game = new RummyGame("oklahoma-rum", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.tableMelds = [
      {
        owner: "computer",
        type: "set",
        cards: [
          card(CardName.Queen, Suit.Hearts),
          card(CardName.Queen, Suit.Diamonds),
          card(CardName.Queen, Suit.Clubs),
        ],
      },
    ];
    s.playerHand = [
      card(CardName.Queen, Suit.Spades),
      card(CardName.Nine, Suit.Clubs),
    ];

    expect(game.playerLayOff(0, 0)).toBe(true);
    expect(s.meldPoints.player).toBe(50);
  });
});
