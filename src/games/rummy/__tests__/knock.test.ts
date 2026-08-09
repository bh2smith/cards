import { test, expect, describe } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import { RummyGame } from "../game";
import type { RummyState } from "../types";
import { createDeck } from "../../../shared/deck";
import { UNDERCUT_BONUS } from "../rules";

const DECK = createDeck();
const card = (name: CardName, suit: Suit): PlayingCard =>
  DECK.find((c) => c.cardName === name && c.suit === suit)!;

function mut(game: RummyGame): RummyState {
  return game.getState() as RummyState;
}

/** Three clean melds (9 cards) leaving room for controlled deadwood. */
const THREE_MELDS = [
  card(CardName.Three, Suit.Spades),
  card(CardName.Four, Suit.Spades),
  card(CardName.Five, Suit.Spades),
  card(CardName.Nine, Suit.Clubs),
  card(CardName.Nine, Suit.Diamonds),
  card(CardName.Nine, Suit.Hearts),
  card(CardName.Six, Suit.Diamonds),
  card(CardName.Seven, Suit.Diamonds),
  card(CardName.Eight, Suit.Diamonds),
];

/** Ten meldless cards worth 2+4+6+8+10+10+10+1+3+5 = 59 deadwood. */
const MELDLESS_59 = [
  card(CardName.Two, Suit.Clubs),
  card(CardName.Four, Suit.Hearts),
  card(CardName.Six, Suit.Clubs),
  card(CardName.Eight, Suit.Hearts),
  card(CardName.Ten, Suit.Spades),
  card(CardName.Queen, Suit.Diamonds),
  card(CardName.King, Suit.Spades),
  card(CardName.Ace, Suit.Hearts),
  card(CardName.Three, Suit.Diamonds),
  card(CardName.Five, Suit.Hearts),
];

describe("knock rummy", () => {
  test("preset config: hold-all hands, knock at any deadwood, no lay-offs", () => {
    const cfg = new RummyGame("knock-rummy", 1).getConfig();
    expect(cfg.meldsOnTable).toBe(false);
    expect(cfg.layOffAllowed).toBe(false);
    expect(cfg.knock).toEqual({ threshold: Infinity });
    expect(cfg.scoring).toBe("deadwood-diff");
  });

  test("melding to the table is not allowed", () => {
    const game = new RummyGame("knock-rummy", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.Seven, Suit.Spades),
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
    ];
    expect(game.playerMeld([0, 1, 2])).toBe(false);
  });

  test("knocking with the lower count wins the deadwood difference", () => {
    const game = new RummyGame("knock-rummy", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      ...THREE_MELDS,
      card(CardName.Ace, Suit.Clubs), // deadwood 1
      card(CardName.King, Suit.Hearts), // to discard
    ];
    s.computerHand = [...MELDLESS_59];

    expect(game.playerKnock(10)).toBe(true);
    expect(s.phase).toBe("ROUND_OVER");
    const kr = s.knockResult!;
    expect(kr.knocker).toBe("player");
    expect(kr.knockerDeadwoodValue).toBe(1);
    expect(kr.defenderDeadwoodValue).toBe(59);
    expect(kr.isUndercut).toBe(false);
    expect(kr.pointsTo).toBe("player");
    expect(kr.roundPoints).toBe(58);
    expect(s.playerScore).toBe(58);
    expect(s.roundWinner).toBe("player");
  });

  test("knocking with ANY deadwood is legal (all-deadwood hand)", () => {
    const game = new RummyGame("knock-rummy", 2);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [...MELDLESS_59, card(CardName.Jack, Suit.Hearts)];
    s.computerHand = [
      ...THREE_MELDS,
      card(CardName.Ace, Suit.Clubs), // defender deadwood 1
    ];

    expect(game.playerKnock(10)).toBe(true);
    expect(s.knockResult!.knockerDeadwoodValue).toBe(59);
  });

  test("undercut: defender with equal-or-lower deadwood takes diff + bonus", () => {
    const game = new RummyGame("knock-rummy", 3);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      ...THREE_MELDS,
      card(CardName.Ten, Suit.Hearts), // knocker deadwood 10
      card(CardName.King, Suit.Hearts), // to discard
    ];
    s.computerHand = [
      card(CardName.Three, Suit.Clubs),
      card(CardName.Four, Suit.Clubs),
      card(CardName.Five, Suit.Clubs),
      card(CardName.Ten, Suit.Clubs),
      card(CardName.Ten, Suit.Diamonds),
      card(CardName.Ten, Suit.Spades),
      card(CardName.Six, Suit.Hearts),
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Eight, Suit.Hearts),
      card(CardName.Ace, Suit.Diamonds), // defender deadwood 1
    ];

    expect(game.playerKnock(10)).toBe(true);
    const kr = s.knockResult!;
    expect(kr.isUndercut).toBe(true);
    expect(kr.pointsTo).toBe("computer");
    expect(kr.roundPoints).toBe(10 - 1 + UNDERCUT_BONUS);
    expect(s.computerScore).toBe(19);
    expect(s.playerScore).toBe(0);
  });

  test("a zero-deadwood knock (rum) cannot be undercut", () => {
    const game = new RummyGame("knock-rummy", 4);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      ...THREE_MELDS,
      card(CardName.Nine, Suit.Spades), // completes the 9-set → 0 deadwood
      card(CardName.King, Suit.Hearts), // to discard
    ];
    s.computerHand = [
      card(CardName.Three, Suit.Clubs),
      card(CardName.Four, Suit.Clubs),
      card(CardName.Five, Suit.Clubs),
      card(CardName.Ten, Suit.Clubs),
      card(CardName.Ten, Suit.Diamonds),
      card(CardName.Ten, Suit.Hearts),
      card(CardName.Six, Suit.Hearts),
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Eight, Suit.Hearts),
      card(CardName.Ace, Suit.Diamonds), // deadwood 1 > 0
    ];

    expect(game.playerKnock(10)).toBe(true);
    const kr = s.knockResult!;
    expect(kr.knockerDeadwoodValue).toBe(0);
    expect(kr.isUndercut).toBe(false);
    expect(kr.pointsTo).toBe("player");
    expect(kr.roundPoints).toBe(1);
  });

  test("stock exhaustion settles on best-meld deadwood difference", () => {
    const game = new RummyGame("knock-rummy", 5);
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.stock = [];
    s.reshuffles = 1;
    s.discardPile = [card(CardName.Nine, Suit.Spades)];
    s.playerHand = [...THREE_MELDS, card(CardName.Ace, Suit.Clubs)]; // dw 1
    s.computerHand = [...MELDLESS_59]; // dw 59

    expect(game.playerDrawFromStock()).toBe(true);
    expect(s.phase).toBe("ROUND_OVER");
    expect(s.roundWinner).toBe("player");
    expect(s.roundPoints).toBe(58);
  });
});
