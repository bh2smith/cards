import { test, expect, beforeEach } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import { MichiganGame } from "../game";
import type { MichiganState } from "../types";
import { createDeck } from "../../../shared/deck";
import { resetBankrollForTests } from "../../../shared/engine/bankroll";

const DECK = createDeck();
const card = (name: CardName, suit: Suit): PlayingCard =>
  DECK.find((c) => c.cardName === name && c.suit === suit)!;

beforeEach(() => resetBankrollForTests());

function mutableState(game: MichiganGame): MichiganState {
  return (game as unknown as { state: MichiganState }).state;
}

function craft(game: MichiganGame, hands: PlayingCard[][]): MichiganState {
  game.deal();
  const s = mutableState(game);
  s.phase = "AWAIT_PLAY";
  s.currentTurn = 0;
  s.played = [];
  s.hands = hands;
  return s;
}

test("deal: 13 cards each, everyone antes one chip into the pot", () => {
  const game = new MichiganGame("fan-tan", 5);
  game.deal();
  const s = game.getState();
  expect(s.phase).toBe("AWAIT_PLAY");
  s.hands.forEach((h) => expect(h).toHaveLength(13));
  expect(s.pot).toBe(4);
  expect(s.chips).toEqual([49, 49, 49, 49]);
  expect(s.currentTurn).toBe(0); // eldest, left of dealer 3
});

test("only sevens and cards adjacent to an open row are legal", () => {
  const game = new MichiganGame("fan-tan", 5);
  const s = craft(game, [
    [
      card(CardName.Seven, Suit.Spades),
      card(CardName.Eight, Suit.Hearts),
      card(CardName.Six, Suit.Diamonds),
      card(CardName.Five, Suit.Clubs),
      card(CardName.Nine, Suit.Hearts),
    ],
    [card(CardName.Two, Suit.Spades)],
    [card(CardName.Three, Suit.Spades)],
    [card(CardName.Four, Suit.Spades)],
  ]);
  s.rows[Suit.Hearts] = { low: 7, high: 7 };
  s.rows[Suit.Diamonds] = { low: 7, high: 7 };
  s.rows[Suit.Clubs] = { low: 7, high: 7 };

  // 7♠ (seven), 8♥ (high+1), 6♦ (low-1) legal; 5♣ needs the 6 first; 9♥ needs the 8.
  expect(game.legalIndicesFor(0)).toEqual([0, 1, 2]);

  expect(game.humanPlay(3)).toBe(false); // 5♣ rejected
  expect(game.humanPlay(1)).toBe(true); // 8♥ extends up
  expect(s.rows[Suit.Hearts]).toEqual({ low: 7, high: 8 });
  expect(s.currentTurn).toBe(1);
});

test("a seven opens its suit row at 7–7", () => {
  const game = new MichiganGame("fan-tan", 5);
  const s = craft(game, [
    [card(CardName.Seven, Suit.Spades), card(CardName.Two, Suit.Hearts)],
    [card(CardName.Two, Suit.Spades)],
    [card(CardName.Three, Suit.Spades)],
    [card(CardName.Four, Suit.Spades)],
  ]);
  expect(game.humanPlay(0)).toBe(true);
  expect(s.rows[Suit.Spades]).toEqual({ low: 7, high: 7 });
});

test("with no legal play you must pay one chip to the pot and pass", () => {
  const game = new MichiganGame("fan-tan", 5);
  const s = craft(game, [
    [card(CardName.Five, Suit.Clubs)],
    [card(CardName.Seven, Suit.Spades)],
    [card(CardName.Three, Suit.Spades)],
    [card(CardName.Four, Suit.Spades)],
  ]);
  s.rows[Suit.Clubs] = { low: 7, high: 7 };
  const pot = s.pot;

  expect(game.humanMustPass()).toBe(true);
  expect(game.humanPlay(0)).toBe(false);
  expect(game.humanPass()).toBe(true);
  expect(s.chips[0]).toBe(49 - 1);
  expect(s.pot).toBe(pot + 1);
  expect(s.currentTurn).toBe(1);
});

test("pass is rejected while a legal play exists", () => {
  const game = new MichiganGame("fan-tan", 5);
  craft(game, [
    [card(CardName.Seven, Suit.Spades)],
    [card(CardName.Two, Suit.Spades)],
    [card(CardName.Three, Suit.Spades)],
    [card(CardName.Four, Suit.Spades)],
  ]);
  expect(game.humanMustPass()).toBe(false);
  expect(game.humanPass()).toBe(false);
});

test("first player out takes the whole pot plus per-card payments", () => {
  const game = new MichiganGame("fan-tan", 99);
  game.autoPilot = true;
  game.deal();

  let steps = 0;
  while (game.getState().phase === "AWAIT_PLAY" && steps++ < 1000) {
    game.botStep();
  }
  const s = game.getState();
  expect(s.phase).toBe("HAND_OVER");
  const w = s.handWinner!;
  expect(s.hands[w]).toHaveLength(0);
  expect(s.pot).toBe(0); // swept by the winner
  // Winner nets at least the antes of the other three plus their cards.
  expect(s.chips[w]!).toBeGreaterThan(50);
  const total = s.chips.reduce((a, b) => a + b, 0);
  expect(total).toBe(200);
});
