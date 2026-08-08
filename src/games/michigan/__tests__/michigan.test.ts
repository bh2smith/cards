import { test, expect, beforeEach } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import { MichiganGame } from "../game";
import type { MichiganState } from "../types";
import { eligibleLeadSuits, shouldBotSwap } from "../modes/michigan";
import { cardKey, createDeck } from "../../../shared/deck";
import { resetBankrollForTests } from "../../../shared/engine/bankroll";

const DECK = createDeck();
const card = (name: CardName, suit: Suit): PlayingCard =>
  DECK.find((c) => c.cardName === name && c.suit === suit)!;

beforeEach(() => resetBankrollForTests());

function mutableState(game: MichiganGame): MichiganState {
  return (game as unknown as { state: MichiganState }).state;
}

/** Deal, then overwrite the position with a crafted mid-hand scenario. */
function craft(
  game: MichiganGame,
  hands: PlayingCard[][],
  dead: PlayingCard[] = [],
): MichiganState {
  game.deal();
  const s = mutableState(game);
  s.phase = "AWAIT_LEAD";
  s.currentTurn = 0;
  s.prevSuit = null;
  s.sequence = null;
  s.played = [];
  s.hands = hands;
  s.deadHand = dead;
  return s;
}

test("deal: 11/11/10/10 hands plus a 10-card widow, dealer swap offered", () => {
  const game = new MichiganGame(undefined, 3);
  mutableState(game).dealer = 0; // human deals → DEALER_SWAP phase
  game.deal();
  const s = game.getState();
  expect(s.phase).toBe("DEALER_SWAP");
  const sizes = s.hands.map((h) => h.length).sort((a, b) => b - a);
  expect(sizes).toEqual([11, 11, 10, 10]);
  expect(s.deadHand.length).toBe(10);
  const all = [...s.hands.flat(), ...s.deadHand].map(cardKey);
  expect(new Set(all).size).toBe(52);
});

test("dealer ante is double: boodle holds 5 chips per card after the deal", () => {
  const game = new MichiganGame(undefined, 3);
  game.deal();
  const s = game.getState();
  for (const slot of s.boodle) expect(slot.chips).toBe(5); // 3×1 + 2
  expect(s.chips[s.dealer]).toBe(50 - 8);
});

test("human dealer swaps the hand for the widow sight unseen", () => {
  const game = new MichiganGame(undefined, 7);
  mutableState(game).dealer = 0;
  game.deal();
  const before = game.getState();
  const widow = before.deadHand.map(cardKey).sort();
  const hand = before.hands[0]!.map(cardKey).sort();

  game.dealerSwap(true);
  const after = game.getState();
  expect(after.hands[0]!.map(cardKey).sort()).toEqual(widow);
  expect(after.deadHand.map(cardKey).sort()).toEqual(hand);
  expect(after.phase).toBe("AWAIT_LEAD");
  expect(after.currentTurn).toBe(1); // eldest, left of dealer 0
});

test("bot swap heuristic: swap only with fewer than two cards ranked 9+", () => {
  const weak = [
    card(CardName.Two, Suit.Clubs),
    card(CardName.Five, Suit.Hearts),
    card(CardName.King, Suit.Spades),
  ];
  expect(shouldBotSwap(weak)).toBe(true);
  const strong = [...weak, card(CardName.Ace, Suit.Diamonds)];
  expect(shouldBotSwap(strong)).toBe(false);
});

test("playing a boodle card collects its chips", () => {
  const game = new MichiganGame(undefined, 1);
  const s = craft(game, [
    [card(CardName.Ace, Suit.Hearts), card(CardName.Two, Suit.Clubs)],
    [card(CardName.Nine, Suit.Spades)],
    [card(CardName.Nine, Suit.Diamonds)],
    [card(CardName.Nine, Suit.Clubs)],
  ]);
  const slot = s.boodle.find(
    (b) => b.cardName === CardName.Ace && b.suit === Suit.Hearts,
  )!;
  slot.chips = 6;
  const before = s.chips[0]!;

  // A♥ is the lowest (only) heart, so it is a legal lead.
  const idx = s.hands[0]!.findIndex((c) => c.cardName === CardName.Ace);
  expect(game.humanPlay(idx)).toBe(true);
  expect(s.chips[0]).toBe(before + 6);
  expect(slot.chips).toBe(0);
});

test("lead must be the lowest card of the chosen suit", () => {
  const game = new MichiganGame(undefined, 1);
  const s = craft(game, [
    [card(CardName.Five, Suit.Hearts), card(CardName.Ten, Suit.Hearts)],
    [card(CardName.Nine, Suit.Spades)],
    [card(CardName.Nine, Suit.Diamonds)],
    [card(CardName.Nine, Suit.Clubs)],
  ]);
  const tenIdx = s.hands[0]!.findIndex((c) => c.cardName === CardName.Ten);
  expect(game.humanPlay(tenIdx)).toBe(false); // not the lowest heart
  const fiveIdx = s.hands[0]!.findIndex((c) => c.cardName === CardName.Five);
  expect(game.humanPlay(fiveIdx)).toBe(true);
});

test("run stops at a dead card and the last player leads the opposite color", () => {
  const game = new MichiganGame(undefined, 2);
  const s = craft(
    game,
    [
      [card(CardName.Five, Suit.Hearts), card(CardName.Ten, Suit.Hearts)],
      [
        card(CardName.Six, Suit.Hearts),
        card(CardName.Two, Suit.Clubs),
        card(CardName.Nine, Suit.Clubs),
      ],
      [card(CardName.Nine, Suit.Diamonds)],
      [card(CardName.King, Suit.Diamonds)],
    ],
    [card(CardName.Seven, Suit.Hearts)], // the stop card is dead
  );

  expect(game.humanPlay(0)).toBe(true); // lead 5♥
  expect(s.phase).toBe("AWAIT_PLAY");
  expect(s.currentTurn).toBe(1); // Left holds 6♥ — turn-independent

  expect(game.botStep()).toBe(true); // Left plays 6♥; 7♥ is dead → stop
  expect(s.phase).toBe("AWAIT_LEAD");
  expect(s.currentTurn).toBe(1); // last to add a card leads next
  expect(s.prevSuit).toBe(Suit.Hearts);

  expect(game.botStep()).toBe(true); // Left must lead a black suit: 2♣
  // The 2♣ run stops immediately (no 3♣ in play), leaving clubs as prevSuit.
  const lastPlayed = s.played[s.played.length - 1]!;
  expect(lastPlayed.suit).toBe(Suit.Clubs);
  expect(lastPlayed.cardName).toBe(CardName.Two);
  expect(s.prevSuit).toBe(Suit.Clubs);
});

test("an Ace ends the run", () => {
  const game = new MichiganGame(undefined, 2);
  const s = craft(game, [
    [card(CardName.King, Suit.Spades), card(CardName.Three, Suit.Hearts)],
    [card(CardName.Ace, Suit.Spades), card(CardName.Four, Suit.Hearts)],
    [card(CardName.Nine, Suit.Diamonds)],
    [card(CardName.Nine, Suit.Clubs)],
  ]);
  expect(game.humanPlay(0)).toBe(true); // lead K♠
  expect(game.botStep()).toBe(true); // Left plays A♠ — run over
  expect(s.phase).toBe("AWAIT_LEAD");
  expect(s.currentTurn).toBe(1);
  expect(s.prevSuit).toBe(Suit.Spades);
});

test("eligibleLeadSuits: opposite color first, then any different, then same", () => {
  const redAndBlack = [
    card(CardName.Two, Suit.Hearts),
    card(CardName.Two, Suit.Diamonds),
    card(CardName.Two, Suit.Spades),
  ];
  expect(eligibleLeadSuits(redAndBlack, Suit.Hearts)).toEqual([Suit.Spades]);

  const redOnly = [
    card(CardName.Two, Suit.Hearts),
    card(CardName.Two, Suit.Diamonds),
  ];
  expect(eligibleLeadSuits(redOnly, Suit.Hearts)).toEqual([Suit.Diamonds]);

  const heartsOnly = [card(CardName.Two, Suit.Hearts)];
  expect(eligibleLeadSuits(heartsOnly, Suit.Hearts)).toEqual([Suit.Hearts]);

  expect(new Set(eligibleLeadSuits(redAndBlack, null))).toEqual(
    new Set([Suit.Hearts, Suit.Diamonds, Suit.Spades]),
  );
});

test("going out settles one chip per card left in each opponent's hand", () => {
  const game = new MichiganGame(undefined, 3);
  const s = craft(game, [
    [card(CardName.Two, Suit.Clubs)],
    [
      card(CardName.Nine, Suit.Spades),
      card(CardName.Ten, Suit.Spades),
      card(CardName.Jack, Suit.Hearts),
    ],
    [card(CardName.Nine, Suit.Diamonds), card(CardName.Ten, Suit.Diamonds)],
    [card(CardName.Nine, Suit.Hearts)],
  ]);
  const before = [...s.chips];

  expect(game.humanPlay(0)).toBe(true); // last card — hand over
  expect(s.phase).toBe("HAND_OVER");
  expect(s.handWinner).toBe(0);
  expect(s.chips[0]).toBe(before[0]! + 6);
  expect(s.chips[1]).toBe(before[1]! - 3);
  expect(s.chips[2]).toBe(before[2]! - 2);
  expect(s.chips[3]).toBe(before[3]! - 1);
});

test("unclaimed boodle chips carry over into the next hand's ante", () => {
  const game = new MichiganGame(undefined, 11);
  game.autoPilot = true;
  game.deal();
  let steps = 0;
  while (game.getState().phase !== "HAND_OVER" && steps++ < 500) {
    game.botStep();
  }
  const leftover = game.getState().boodle.reduce((a, b) => a + b.chips, 0);
  game.deal();
  const after = game.getState().boodle.reduce((a, b) => a + b.chips, 0);
  expect(after).toBe(leftover + 4 * 5); // re-ante stacks on top
});
