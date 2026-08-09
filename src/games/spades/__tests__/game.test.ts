import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { SpadesGame } from "../game";
import { type PlayerIndex, type SpadesState, teamContract } from "../types";

function c(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

/** Mutable view of the live state, for crafting hands in tests. */
function liveState(game: SpadesGame): SpadesState {
  return game.getState() as SpadesState;
}

describe("bidding", () => {
  test("bidding starts left of the dealer and proceeds in order", () => {
    const game = new SpadesGame(7);
    const s = game.getState();
    expect(s.phase).toBe("BIDDING");
    expect(s.dealer).toBe(3); // first dealer is seat 3 → You bid first
    expect(s.bidTurn).toBe(0);

    expect(game.placeBid(1, 3)).toBe(false); // out of turn
    expect(game.placeBid(0, 14)).toBe(false); // out of range
    expect(game.placeBid(0, 3)).toBe(true);
    expect(game.getState().bidTurn).toBe(1);
    expect(game.placeBid(1, 0)).toBe(true); // nil
    expect(game.placeBid(2, 4)).toBe(true);
    expect(game.placeBid(3, 2)).toBe(true);

    const after = game.getState();
    expect(after.bids).toEqual([3, 0, 4, 2]);
    expect(after.phase).toBe("PLAYING");
    // Team contract = sum of the partners' bids (nil = 0).
    expect(teamContract(after.bids, 0)).toBe(7);
    expect(teamContract(after.bids, 1)).toBe(2);
    // Eldest hand (left of dealer) leads the first trick.
    expect(after.currentTrick!.leader).toBe(0);
    expect(after.currentTurn).toBe(0);
  });

  test("dealer rotates between hands", () => {
    const game = new SpadesGame(11);
    game.autoPilot = true;
    while (game.getState().phase === "BIDDING") game.botBid();
    while (game.getState().phase === "PLAYING") game.botPlay();
    const before = game.getState().dealer;
    if (game.getState().phase === "HAND_OVER") {
      game.nextHand();
      expect(game.getState().dealer).toBe(((before + 1) % 4) as PlayerIndex);
      expect(game.getState().phase).toBe("BIDDING");
    }
  });
});

describe("play rules through the game API", () => {
  /** Bids 1-1-1-1 then installs crafted hands with seat 0 to lead. */
  function craftedGame(hands: PlayingCard[][]): SpadesGame {
    const game = new SpadesGame(1);
    game.placeBid(0, 1);
    game.placeBid(1, 1);
    game.placeBid(2, 1);
    game.placeBid(3, 1);
    const s = liveState(game);
    s.hands = hands.map((h) => [...h]);
    return game;
  }

  test("cannot lead a spade before spades are broken", () => {
    const game = craftedGame([
      [c(CardName.Ace, Suit.Spades), c(CardName.Two, Suit.Hearts)],
      [c(CardName.Three, Suit.Hearts), c(CardName.Four, Suit.Hearts)],
      [c(CardName.Five, Suit.Hearts), c(CardName.Six, Suit.Hearts)],
      [c(CardName.Seven, Suit.Hearts), c(CardName.Eight, Suit.Hearts)],
    ]);
    expect(game.playCard(0, c(CardName.Ace, Suit.Spades))).toBe(false);
    expect(game.playCard(0, c(CardName.Two, Suit.Hearts))).toBe(true);
  });

  test("spades-only hand may lead a spade unbroken", () => {
    const game = craftedGame([
      [c(CardName.Ace, Suit.Spades), c(CardName.Two, Suit.Spades)],
      [c(CardName.Three, Suit.Hearts), c(CardName.Four, Suit.Hearts)],
      [c(CardName.Five, Suit.Hearts), c(CardName.Six, Suit.Hearts)],
      [c(CardName.Seven, Suit.Hearts), c(CardName.Eight, Suit.Hearts)],
    ]);
    expect(game.playCard(0, c(CardName.Two, Suit.Spades))).toBe(true);
    expect(game.getState().spadesBroken).toBe(true);
  });

  test("must follow suit when able; discarding a spade breaks them", () => {
    const game = craftedGame([
      [c(CardName.Two, Suit.Hearts), c(CardName.King, Suit.Clubs)],
      [c(CardName.Ace, Suit.Hearts), c(CardName.Four, Suit.Clubs)],
      [c(CardName.Nine, Suit.Spades), c(CardName.Six, Suit.Clubs)], // void in hearts
      [c(CardName.Seven, Suit.Hearts), c(CardName.Eight, Suit.Clubs)],
    ]);
    expect(game.playCard(0, c(CardName.Two, Suit.Hearts))).toBe(true);
    // Seat 1 holds a heart: the club is illegal.
    expect(game.playCard(1, c(CardName.Four, Suit.Clubs))).toBe(false);
    expect(game.playCard(1, c(CardName.Ace, Suit.Hearts))).toBe(true);
    // Seat 2 is void in hearts and may ruff, breaking spades.
    expect(game.playCard(2, c(CardName.Nine, Suit.Spades))).toBe(true);
    expect(game.getState().spadesBroken).toBe(true);
    expect(game.playCard(3, c(CardName.Seven, Suit.Hearts))).toBe(true);
    // The ruff wins over the ace of the led suit.
    const trick = game.getState().completedTricks[0]!;
    expect(trick.winner).toBe(2);
    expect(game.getState().currentTurn).toBe(2);
    expect(game.getState().tricksWon).toEqual([1, 0]);
  });

  test("playing out of turn or a card not held is rejected", () => {
    const game = craftedGame([
      [c(CardName.Two, Suit.Hearts)],
      [c(CardName.Three, Suit.Hearts)],
      [c(CardName.Four, Suit.Hearts)],
      [c(CardName.Five, Suit.Hearts)],
    ]);
    expect(game.playCard(2, c(CardName.Four, Suit.Hearts))).toBe(false);
    expect(game.playCard(0, c(CardName.Nine, Suit.Diamonds))).toBe(false);
  });
});
