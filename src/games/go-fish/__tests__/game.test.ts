import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { GoFishGame } from "../game";
import { chooseAsk } from "../ai";
import type { GoFishState } from "../types";
import { HAND_SIZE, TOTAL_BOOKS, countRank } from "../types";

function card(rank: CardName, suit: Suit = Suit.Spades): PlayingCard {
  return new PlayingCard(rank, suit);
}

/** The live, mutable state object (getState returns the real reference). */
function mut(game: GoFishGame): GoFishState {
  return game.getState() as GoFishState;
}

function expectConserved(state: Readonly<GoFishState>): void {
  const total =
    state.playerHand.length +
    state.computerHand.length +
    state.pond.length +
    4 * (state.playerBooks.length + state.computerBooks.length);
  expect(total).toBe(52);
}

describe("deal", () => {
  test("deals 7 cards each and the rest to the pond, deterministically", () => {
    const a = new GoFishGame(42);
    const b = new GoFishGame(42);
    const state = a.getState();

    expect(state.phase).toBe("PLAYER_TURN");
    expect(state.playerHand.length).toBe(HAND_SIZE);
    expect(state.computerHand.length).toBe(HAND_SIZE);
    expect(state.pond.length).toBe(52 - 2 * HAND_SIZE);
    expectConserved(state);

    expect(
      b.getState().playerHand.map((c) => `${c.cardName}-${c.suit}`),
    ).toEqual(state.playerHand.map((c) => `${c.cardName}-${c.suit}`));
  });
});

describe("asking", () => {
  test("successful ask transfers all cards of the rank and the turn repeats", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerHand = [card(CardName.Ace, Suit.Spades), card(CardName.Five)];
    st.computerHand = [
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Ace, Suit.Diamonds),
      card(CardName.Two, Suit.Clubs),
    ];

    const outcome = game.playerAsk(CardName.Ace)!;
    expect(outcome.gained).toBe(2);
    expect(outcome.turnEnded).toBe(false);
    expect(countRank(st.playerHand, CardName.Ace)).toBe(3);
    expect(countRank(st.computerHand, CardName.Ace)).toBe(0);
    expect(game.getState().phase).toBe("PLAYER_TURN");
  });

  test("failed ask goes fishing and passes the turn", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerHand = [card(CardName.Ace)];
    st.computerHand = [card(CardName.Two, Suit.Clubs)];
    st.pond = [card(CardName.King, Suit.Hearts)];

    const outcome = game.playerAsk(CardName.Ace)!;
    expect(outcome.gained).toBe(0);
    expect(outcome.fished!.cardName).toBe(CardName.King);
    expect(outcome.lucky).toBe(false);
    expect(outcome.turnEnded).toBe(true);
    expect(countRank(game.getState().playerHand, CardName.King)).toBe(1);
    expect(game.getState().phase).toBe("BOT_TURN");
  });

  test("lucky draw of the asked rank lets the player ask again", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerHand = [card(CardName.Ace, Suit.Spades)];
    st.computerHand = [card(CardName.Two, Suit.Clubs)];
    // pop() draws from the end, so the Ace is the next fish.
    st.pond = [card(CardName.Nine), card(CardName.Ace, Suit.Hearts)];

    const outcome = game.playerAsk(CardName.Ace)!;
    expect(outcome.lucky).toBe(true);
    expect(outcome.turnEnded).toBe(false);
    expect(countRank(st.playerHand, CardName.Ace)).toBe(2);
    expect(game.getState().phase).toBe("PLAYER_TURN");
  });

  test("go fish on an empty pond just ends the turn", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerHand = [card(CardName.Ace)];
    st.computerHand = [card(CardName.Two, Suit.Clubs)];
    st.pond = [];

    // Neither hand is empty afterwards, so the game continues on the bot's turn.
    const outcome = game.playerAsk(CardName.Ace)!;
    expect(outcome.fished).toBeNull();
    expect(outcome.turnEnded).toBe(true);
    expect(game.getState().phase).toBe("BOT_TURN");
  });

  test("asking for a rank you do not hold is rejected", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerHand = [card(CardName.Ace)];

    expect(game.playerAsk(CardName.King)).toBeNull();
    expect(game.getState().phase).toBe("PLAYER_TURN");
  });
});

describe("books", () => {
  test("a completed book is laid down immediately", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerHand = [
      card(CardName.Ace, Suit.Spades),
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Ace, Suit.Diamonds),
      card(CardName.Two, Suit.Clubs),
    ];
    st.computerHand = [card(CardName.Ace, Suit.Clubs), card(CardName.Three)];

    game.playerAsk(CardName.Ace);
    expect(mut(game).playerBooks).toEqual([CardName.Ace]);
    expect(countRank(mut(game).playerHand, CardName.Ace)).toBe(0);
    expect(game.getState().phase).toBe("PLAYER_TURN");
  });

  test("a player left with an empty hand on their turn draws from the pond", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerHand = [
      card(CardName.Ace, Suit.Spades),
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Ace, Suit.Diamonds),
    ];
    st.computerHand = [card(CardName.Ace, Suit.Clubs), card(CardName.King)];
    st.pond = [card(CardName.Queen, Suit.Hearts)];

    game.playerAsk(CardName.Ace);
    const after = game.getState();
    expect(after.playerBooks).toEqual([CardName.Ace]);
    expect(after.playerHand.length).toBe(1);
    expect(after.playerHand[0]!.cardName).toBe(CardName.Queen);
    expect(after.phase).toBe("PLAYER_TURN");
  });
});

describe("end conditions", () => {
  test("game ends when all 13 books are made", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerBooks = [
      CardName.Ace,
      CardName.Two,
      CardName.Three,
      CardName.Four,
      CardName.Five,
      CardName.Six,
      CardName.Seven,
      CardName.Eight,
      CardName.Nine,
      CardName.Ten,
      CardName.Jack,
      CardName.Queen,
    ];
    st.computerBooks = [];
    st.playerHand = [
      card(CardName.King, Suit.Spades),
      card(CardName.King, Suit.Hearts),
      card(CardName.King, Suit.Diamonds),
    ];
    st.computerHand = [card(CardName.King, Suit.Clubs)];
    st.pond = [];

    game.playerAsk(CardName.King);
    const after = game.getState();
    expect(after.playerBooks.length + after.computerBooks.length).toBe(
      TOTAL_BOOKS,
    );
    expect(after.phase).toBe("GAME_OVER");
    expect(after.winner).toBe("player");
  });

  test("game ends when the pond and a hand are both empty; tie gives no winner", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerBooks = [];
    st.computerBooks = [];
    st.playerHand = [card(CardName.Ace), card(CardName.Two, Suit.Hearts)];
    st.computerHand = [card(CardName.Two, Suit.Clubs)];
    st.pond = [];

    game.playerAsk(CardName.Two);
    const after = game.getState();
    expect(after.computerHand.length).toBe(0);
    expect(after.phase).toBe("GAME_OVER");
    expect(after.winner).toBeNull();
    expect(after.message.toLowerCase()).toContain("tie");
  });

  test("most books wins a drained game", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerBooks = [CardName.Nine];
    st.computerBooks = [];
    st.playerHand = [card(CardName.Ace), card(CardName.Two, Suit.Hearts)];
    st.computerHand = [card(CardName.Two, Suit.Clubs)];
    st.pond = [];

    game.playerAsk(CardName.Two);
    expect(game.getState().phase).toBe("GAME_OVER");
    expect(game.getState().winner).toBe("player");
  });
});

describe("full seeded games", () => {
  test("cards are conserved after every action and the bot only asks for held ranks", () => {
    for (const seed of [1, 2, 3, 42, 1337]) {
      const game = new GoFishGame(seed);
      expectConserved(game.getState());

      let guard = 0;
      while (game.getState().phase !== "GAME_OVER" && guard++ < 500) {
        const state = game.getState();
        if (state.phase === "PLAYER_TURN") {
          expect(state.playerHand.length).toBeGreaterThan(0);
          game.playerAsk(state.playerHand[0]!.cardName);
        } else {
          const held = new Set(state.computerHand.map((c) => c.cardName));
          const outcome = game.botAsk();
          expect(held.has(outcome.rank)).toBe(true);
        }
        expectConserved(game.getState());
      }

      const final = game.getState();
      expect(final.phase).toBe("GAME_OVER");
      const books = final.playerBooks.length + final.computerBooks.length;
      expect(
        books === TOTAL_BOOKS ||
          (final.pond.length === 0 &&
            (final.playerHand.length === 0 || final.computerHand.length === 0)),
      ).toBe(true);
      if (final.winner === "player") {
        expect(final.playerBooks.length).toBeGreaterThan(
          final.computerBooks.length,
        );
      }
    }
  });
});

describe("bot memory", () => {
  test("remembers ranks the player asks for", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerHand = [card(CardName.Ace)];
    st.computerHand = [card(CardName.Two, Suit.Clubs)];
    st.pond = [card(CardName.Nine, Suit.Hearts)];

    game.playerAsk(CardName.Ace);
    expect(game.getBotMemory().has(CardName.Ace)).toBe(true);
  });

  test("clears a rank once the bot takes those cards", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerHand = [card(CardName.Ace, Suit.Spades)];
    st.computerHand = [card(CardName.Two, Suit.Clubs)];
    st.pond = [card(CardName.Nine, Suit.Hearts), card(CardName.Ten)];

    game.playerAsk(CardName.Ace); // remembered; player draws the Ten, turn passes
    expect(game.getBotMemory().has(CardName.Ace)).toBe(true);

    // Simulate the bot later drawing an Ace, then acting on the belief.
    st.computerHand.push(card(CardName.Ace, Suit.Clubs));
    const outcome = game.botAsk();
    expect(outcome.rank).toBe(CardName.Ace);
    expect(outcome.gained).toBe(1);
    expect(game.getBotMemory().has(CardName.Ace)).toBe(false);
  });

  test("clears a rank once it is booked", () => {
    const game = new GoFishGame(1);
    const st = mut(game);
    st.playerHand = [
      card(CardName.Ace, Suit.Spades),
      card(CardName.Ace, Suit.Hearts),
      card(CardName.Ace, Suit.Diamonds),
      card(CardName.Five),
    ];
    st.computerHand = [card(CardName.Ace, Suit.Clubs), card(CardName.King)];

    game.playerAsk(CardName.Ace);
    expect(mut(game).playerBooks).toEqual([CardName.Ace]);
    expect(game.getBotMemory().has(CardName.Ace)).toBe(false);
  });
});

describe("chooseAsk", () => {
  const rng = () => 0;

  test("prefers a remembered player rank it also holds", () => {
    const hand = [
      card(CardName.Ace, Suit.Spades),
      card(CardName.Five, Suit.Clubs),
      card(CardName.Five, Suit.Diamonds),
    ];
    const beliefs = new Set([CardName.Ace]);
    expect(chooseAsk(hand, beliefs, rng)).toBe(CardName.Ace);
  });

  test("ignores remembered ranks it does not hold and falls back to most-held", () => {
    const hand = [
      card(CardName.Five, Suit.Clubs),
      card(CardName.Five, Suit.Diamonds),
      card(CardName.Nine, Suit.Spades),
    ];
    const beliefs = new Set([CardName.King]);
    expect(chooseAsk(hand, beliefs, rng)).toBe(CardName.Five);
  });

  test("breaks most-held ties via the provided rng", () => {
    const hand = [card(CardName.Five, Suit.Clubs), card(CardName.Nine)];
    expect(chooseAsk(hand, new Set(), () => 0)).toBe(CardName.Five);
    expect(chooseAsk(hand, new Set(), () => 0.99)).toBe(CardName.Nine);
  });

  test("throws on an empty hand", () => {
    expect(() => chooseAsk([], new Set(), rng)).toThrow();
  });
});
