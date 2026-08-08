import { test, expect, beforeEach } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import { MichiganGame } from "../game";
import type { MichiganState } from "../types";
import { wrapNext } from "../modes/play-or-pay";
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
  s.phase = "AWAIT_LEAD";
  s.currentTurn = 0;
  s.sequence = null;
  s.startedSuits = [];
  s.played = [];
  s.hands = hands;
  return s;
}

test("wrapNext goes round the corner: …Q, K, A, 2…", () => {
  expect(wrapNext(12)).toBe(13); // Q → K
  expect(wrapNext(13)).toBe(1); // K → A
  expect(wrapNext(1)).toBe(2); // A → 2
});

test("forced plays continue clockwise round the corner", () => {
  const game = new MichiganGame("play-or-pay", 9);
  const s = craft(game, [
    [card(CardName.King, Suit.Spades), card(CardName.Three, Suit.Hearts)],
    [card(CardName.Ace, Suit.Spades), card(CardName.Nine, Suit.Hearts)],
    [card(CardName.Two, Suit.Spades), card(CardName.Nine, Suit.Diamonds)],
    [card(CardName.Three, Suit.Spades), card(CardName.Nine, Suit.Clubs)],
  ]);

  expect(game.humanPlay(0)).toBe(true); // lead K♠
  expect(s.sequence!.nextOrder).toBe(1); // Ace next
  expect(s.phase).toBe("AWAIT_FORCED");
  expect(s.currentTurn).toBe(1);

  expect(game.botStep()).toBe(true); // Left forced to play A♠
  expect(s.sequence!.nextOrder).toBe(2);
  expect(s.currentTurn).toBe(2);

  expect(game.botStep()).toBe(true); // Top forced to play 2♠
  expect(s.sequence!.nextOrder).toBe(3);
  expect(s.currentTurn).toBe(3);
  expect(s.sequence!.playedCount).toBe(3);
});

test("a player without the forced card pays one chip to the pot", () => {
  const game = new MichiganGame("play-or-pay", 9);
  const s = craft(game, [
    [card(CardName.King, Suit.Spades), card(CardName.Three, Suit.Hearts)],
    [card(CardName.Nine, Suit.Hearts), card(CardName.Ten, Suit.Hearts)],
    [card(CardName.Ace, Suit.Spades), card(CardName.Nine, Suit.Diamonds)],
    [card(CardName.Nine, Suit.Clubs)],
  ]);
  expect(game.humanPlay(0)).toBe(true); // K♠ → Ace needed
  const pot = s.pot;
  const chips1 = s.chips[1]!;

  expect(game.botStep()).toBe(true); // Left lacks A♠ → pays
  expect(s.chips[1]).toBe(chips1 - 1);
  expect(s.pot).toBe(pot + 1);
  expect(s.currentTurn).toBe(2);
  expect(s.sequence!.nextOrder).toBe(1); // still waiting on the Ace
});

test("human without the forced card must pay via humanPass", () => {
  const game = new MichiganGame("play-or-pay", 9);
  const s = craft(game, [
    [card(CardName.Three, Suit.Hearts)],
    [card(CardName.King, Suit.Spades), card(CardName.Nine, Suit.Hearts)],
    [card(CardName.Ace, Suit.Spades), card(CardName.Nine, Suit.Diamonds)],
    [card(CardName.Nine, Suit.Clubs)],
  ]);
  s.phase = "AWAIT_FORCED";
  s.currentTurn = 0;
  s.sequence = {
    suit: Suit.Spades,
    nextOrder: 5,
    lastPlayer: 3,
    playedCount: 2,
    cards: [],
  };
  s.startedSuits = [Suit.Spades];

  expect(game.legalIndicesFor(0)).toEqual([]);
  expect(game.humanMustPass()).toBe(true);
  const chips = s.chips[0]!;
  expect(game.humanPass()).toBe(true);
  expect(s.chips[0]).toBe(chips - 1);
  expect(game.getState().currentTurn).toBe(1);
});

test("completing the 13th card of a suit hands the lead to that player", () => {
  const game = new MichiganGame("play-or-pay", 9);
  const s = craft(game, [
    [card(CardName.Three, Suit.Hearts)],
    [
      card(CardName.King, Suit.Spades),
      card(CardName.Nine, Suit.Diamonds),
      card(CardName.Ten, Suit.Diamonds),
    ],
    [card(CardName.Nine, Suit.Hearts)],
    [card(CardName.Nine, Suit.Clubs)],
  ]);
  s.phase = "AWAIT_FORCED";
  s.currentTurn = 1;
  s.sequence = {
    suit: Suit.Spades,
    nextOrder: 13, // King
    lastPlayer: 0,
    playedCount: 12,
    cards: [],
  };
  s.startedSuits = [Suit.Spades];

  expect(game.botStep()).toBe(true); // Left plays K♠ — suit complete
  expect(s.sequence).toBeNull();
  expect(game.getState().phase).toBe("AWAIT_LEAD");
  expect(game.getState().currentTurn).toBe(1);

  expect(game.botStep()).toBe(true); // Left leads a new, unstarted suit
  expect(s.sequence!.suit).toBe(Suit.Diamonds);
  expect(s.startedSuits).toEqual([Suit.Spades, Suit.Diamonds]);
});

test("a lead may not reopen an already started suit", () => {
  const game = new MichiganGame("play-or-pay", 9);
  const s = craft(game, [
    [card(CardName.Three, Suit.Hearts), card(CardName.Nine, Suit.Clubs)],
    [card(CardName.Nine, Suit.Hearts)],
    [card(CardName.Ten, Suit.Hearts)],
    [card(CardName.Jack, Suit.Hearts)],
  ]);
  s.startedSuits = [Suit.Hearts];

  expect(game.legalIndicesFor(0)).toEqual([1]); // only the club
  expect(game.humanPlay(0)).toBe(false);
  expect(game.humanPlay(1)).toBe(true);
});

test("first player out wins the pot and per-card payments", () => {
  const game = new MichiganGame("play-or-pay", 77);
  game.autoPilot = true;
  game.deal();

  let steps = 0;
  while (
    (game.getState().phase === "AWAIT_LEAD" ||
      game.getState().phase === "AWAIT_FORCED") &&
    steps++ < 2000
  ) {
    game.botStep();
  }
  const s = game.getState();
  expect(s.phase).toBe("HAND_OVER");
  const w = s.handWinner!;
  expect(s.hands[w]).toHaveLength(0);
  expect(s.pot).toBe(0);
  expect(s.chips.reduce((a, b) => a + b, 0)).toBe(200);
});
