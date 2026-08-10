import { test, expect, describe, beforeEach } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { FaroGame } from "../game";
import { RANK_COUNT, TURNS_PER_SHOE } from "../types";
import { balance } from "../../../shared/engine/betting";
import {
  resetBankrollForTests,
  STARTING_CHIPS,
} from "../../../shared/engine/bankroll";
import { cardKey, createDeck } from "../../../shared/deck";

beforeEach(() => resetBankrollForTests());

function card(rank: CardName, suit: Suit = Suit.Spades): PlayingCard {
  return new PlayingCard(rank, suit);
}

/**
 * A full 52-card deck starting with the given cards; the remaining standard
 * cards (minus any rank/suit already used) fill the tail in createDeck order.
 * Pass a `tail` to pin cards at the very end (e.g. the hock).
 */
function craftDeck(
  head: PlayingCard[],
  tail: PlayingCard[] = [],
): PlayingCard[] {
  const used = new Set([...head, ...tail].map(cardKey));
  const filler = createDeck().filter((c) => !used.has(cardKey(c)));
  const deck = [...head, ...filler, ...tail];
  expect(deck.length).toBe(52);
  return deck;
}

describe("soda", () => {
  test("first card is burned face-up and counted on the casekeeper", () => {
    const deck = craftDeck([card(CardName.Seven, Suit.Hearts)]);
    const game = new FaroGame(undefined, deck);
    const state = game.getState();
    expect(state.phase).toBe("BETTING");
    expect(cardKey(state.soda)).toBe(cardKey(deck[0]!));
    expect(state.turnNumber).toBe(0);
    expect(state.caseCounts[CardName.Seven]).toBe(1);
    expect(state.caseCounts.reduce((a, b) => a + b, 0)).toBe(1);
  });
});

describe("bet placement", () => {
  test("placing a bet deducts from the bankroll; removing returns it", () => {
    const game = new FaroGame(1);
    expect(game.placeBet(CardName.Queen, 25)).toBe(true);
    expect(balance()).toBe(STARTING_CHIPS - 25);
    expect(game.getState().bets.length).toBe(1);
    expect(game.removeBet(CardName.Queen)).toBe(true);
    expect(balance()).toBe(STARTING_CHIPS);
    expect(game.getState().bets.length).toBe(0);
  });

  test("betting an occupied rank stacks onto the existing wager", () => {
    const game = new FaroGame(1);
    game.placeBet(CardName.Five, 10);
    game.placeBet(CardName.Five, 5);
    const state = game.getState();
    expect(state.bets.length).toBe(1);
    expect(state.bets[0]!.wager.amount).toBe(15);
    expect(balance()).toBe(STARTING_CHIPS - 15);
  });

  test("a bet beyond the balance is rejected without side effects", () => {
    const game = new FaroGame(1);
    expect(game.placeBet(CardName.Ace, STARTING_CHIPS + 1)).toBe(false);
    expect(balance()).toBe(STARTING_CHIPS);
    expect(game.getState().bets.length).toBe(0);
  });
});

describe("turn settlement polarity", () => {
  // Soda 2♥, then turn 1: banker K♠, player Q♠.
  const polarityDeck = () =>
    craftDeck([
      card(CardName.Two, Suit.Hearts),
      card(CardName.King, Suit.Spades),
      card(CardName.Queen, Suit.Spades),
    ]);

  test("a bet on the player's rank wins even money", () => {
    const game = new FaroGame(undefined, polarityDeck());
    game.placeBet(CardName.Queen, 10);
    game.drawTurn();
    expect(balance()).toBe(STARTING_CHIPS + 10);
    expect(game.getState().bets.length).toBe(0);
    expect(game.getState().phase).toBe("TURN_RESULT");
  });

  test("a bet on the banker's rank loses its stake", () => {
    const game = new FaroGame(undefined, polarityDeck());
    game.placeBet(CardName.King, 10);
    game.drawTurn();
    expect(balance()).toBe(STARTING_CHIPS - 10);
    expect(game.getState().bets.length).toBe(0);
  });

  test("a coppered bet on the banker's rank wins", () => {
    const game = new FaroGame(undefined, polarityDeck());
    game.placeBet(CardName.King, 10);
    expect(game.toggleCopper(CardName.King)).toBe(true);
    game.drawTurn();
    expect(balance()).toBe(STARTING_CHIPS + 10);
  });

  test("a coppered bet on the player's rank loses", () => {
    const game = new FaroGame(undefined, polarityDeck());
    game.placeBet(CardName.Queen, 10);
    game.toggleCopper(CardName.Queen);
    game.drawTurn();
    expect(balance()).toBe(STARTING_CHIPS - 10);
  });
});

describe("splits", () => {
  test("bank keeps half the stake, kept half rounded down on odd stakes", () => {
    const deck = craftDeck([
      card(CardName.Two, Suit.Hearts),
      card(CardName.Nine, Suit.Spades),
      card(CardName.Nine, Suit.Clubs),
    ]);
    const game = new FaroGame(undefined, deck);
    game.placeBet(CardName.Nine, 5);
    game.drawTurn();
    // Staked 5, settled at floor(5/2) = 2 → net −3.
    expect(balance()).toBe(STARTING_CHIPS - 3);
    expect(game.getState().bets.length).toBe(0);
    expect(game.getState().lastTurn?.split).toBe(true);
  });

  test("a split takes half of a coppered bet too", () => {
    const deck = craftDeck([
      card(CardName.Two, Suit.Hearts),
      card(CardName.Nine, Suit.Spades),
      card(CardName.Nine, Suit.Clubs),
    ]);
    const game = new FaroGame(undefined, deck);
    game.placeBet(CardName.Nine, 10);
    game.toggleCopper(CardName.Nine);
    game.drawTurn();
    expect(balance()).toBe(STARTING_CHIPS - 5);
  });
});

describe("bets persist across non-matching turns", () => {
  test("the same wager object stays on the layout until its rank turns", () => {
    // Soda 2♥; turn 1: K♠/Q♠; turn 2: K♥/Q♥ — no aces until later.
    const deck = craftDeck([
      card(CardName.Two, Suit.Hearts),
      card(CardName.King, Suit.Spades),
      card(CardName.Queen, Suit.Spades),
      card(CardName.King, Suit.Hearts),
      card(CardName.Queen, Suit.Hearts),
    ]);
    const game = new FaroGame(undefined, deck);
    game.placeBet(CardName.Ace, 10);
    const wager = game.getState().bets[0]!.wager;
    game.drawTurn();
    game.drawTurn();
    const state = game.getState();
    expect(state.bets.length).toBe(1);
    expect(state.bets[0]!.wager).toBe(wager);
    expect(balance()).toBe(STARTING_CHIPS - 10);
  });
});

describe("casekeeper", () => {
  test("counts the soda and both cards of every turn", () => {
    const deck = craftDeck([
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Spades),
      card(CardName.Three, Suit.Clubs),
    ]);
    const game = new FaroGame(undefined, deck);
    game.drawTurn();
    const counts = game.getState().caseCounts;
    expect(counts[CardName.Seven]).toBe(2);
    expect(counts[CardName.Three]).toBe(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
  });

  test("tracks a rank down to its case and dead states over a full shoe", () => {
    const game = new FaroGame(99);
    while (game.getState().phase !== "SHOE_OVER") game.drawTurn();
    const counts = game.getState().caseCounts;
    // Every rank except the hock's is fully accounted for.
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(51);
    expect(counts.filter((c) => c === 4).length).toBe(RANK_COUNT - 1);
    expect(counts[game.getState().hock!.cardName]).toBe(3);
  });
});

describe("end of shoe", () => {
  test("25 turns show 51 cards and leave exactly the hock unshown", () => {
    const game = new FaroGame(7);
    const shown = [cardKey(game.getState().soda)];
    for (let i = 0; i < TURNS_PER_SHOE; i++) {
      game.drawTurn();
      const turn = game.getState().lastTurn!;
      shown.push(cardKey(turn.bankerCard), cardKey(turn.playerCard));
    }
    const state = game.getState();
    expect(state.phase).toBe("SHOE_OVER");
    expect(state.turnNumber).toBe(TURNS_PER_SHOE);
    expect(shown.length).toBe(51);
    expect(state.hock).not.toBeNull();
    // Ledger: burned + turned + hock = the full 52, no duplicates.
    const ledger = new Set([...shown, cardKey(state.hock!)]);
    expect(ledger.size).toBe(52);
  });

  test("drawTurn after the shoe ends is a no-op", () => {
    const game = new FaroGame(7);
    while (game.getState().phase !== "SHOE_OVER") game.drawTurn();
    const before = game.getState();
    game.drawTurn();
    expect(game.getState().turnNumber).toBe(before.turnNumber);
    expect(game.getState().phase).toBe("SHOE_OVER");
  });

  test("unsettled layout bets are returned as a push", () => {
    // Three aces gone by turn 1 (soda + split); the fourth is pinned as hock,
    // so an ace bet placed after turn 1 can never settle and must push.
    const deck = craftDeck(
      [
        card(CardName.Ace, Suit.Clubs),
        card(CardName.Ace, Suit.Diamonds),
        card(CardName.Ace, Suit.Hearts),
      ],
      [card(CardName.Ace, Suit.Spades)],
    );
    const game = new FaroGame(undefined, deck);
    game.drawTurn();
    game.placeBet(CardName.Ace, 10);
    expect(balance()).toBe(STARTING_CHIPS - 10);
    while (game.getState().phase !== "SHOE_OVER") game.drawTurn();
    expect(balance()).toBe(STARTING_CHIPS);
    expect(game.getState().bets.length).toBe(0);
    expect(cardKey(game.getState().hock!)).toBe(
      cardKey(card(CardName.Ace, Suit.Spades)),
    );
  });

  test("newShoe mid-game pushes open bets and reshuffles", () => {
    const game = new FaroGame(3);
    game.placeBet(CardName.Jack, 25);
    game.drawTurn();
    game.newShoe();
    const state = game.getState();
    expect(state.phase).toBe("BETTING");
    expect(state.turnNumber).toBe(0);
    expect(state.bets.length).toBe(0);
    expect(state.caseCounts.reduce((a, b) => a + b, 0)).toBe(1);
    // Jack pushed unless it settled on the one drawn turn.
    expect(balance()).toBeGreaterThanOrEqual(STARTING_CHIPS - 25);
  });
});

describe("full shoe soak", () => {
  test("seeded shoe settles every bet, closes the 52-card ledger, and never goes negative", () => {
    const game = new FaroGame(1234);
    const shown = [cardKey(game.getState().soda)];
    let turn = 0;
    while (game.getState().phase !== "SHOE_OVER") {
      const rank = turn % RANK_COUNT;
      if (
        game.getState().caseCounts[rank]! < 4 &&
        !game.getState().bets.some((b) => b.rank === rank)
      ) {
        game.placeBet(rank, 1);
        if (turn % 3 === 0) game.toggleCopper(rank);
      }
      expect(balance()).toBeGreaterThanOrEqual(0);
      game.drawTurn();
      const last = game.getState().lastTurn!;
      shown.push(cardKey(last.bankerCard), cardKey(last.playerCard));
      expect(balance()).toBeGreaterThanOrEqual(0);
      turn++;
    }
    const state = game.getState();
    expect(turn).toBe(TURNS_PER_SHOE);
    expect(state.bets.length).toBe(0);
    const ledger = new Set([...shown, cardKey(state.hock!)]);
    expect(ledger.size).toBe(52);
    expect(state.balance).toBe(balance());
  });
});
