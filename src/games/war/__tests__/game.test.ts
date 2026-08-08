import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { WarGame, warRank } from "../game";
import { cardKey } from "../../../shared/deck";
import type { WarState } from "../types";

function card(rank: CardName, suit: Suit = Suit.Spades): PlayingCard {
  return new PlayingCard(rank, suit);
}

function totalCards(state: Readonly<WarState>): number {
  return (
    state.playerPile.length +
    state.computerPile.length +
    state.table.length +
    (state.playerBattle ? 1 : 0) +
    (state.computerBattle ? 1 : 0)
  );
}

function keys(cards: PlayingCard[]): string[] {
  return cards.map(cardKey);
}

describe("setup", () => {
  test("seeded deal splits 52 unique cards into two 26-card piles", () => {
    const game = new WarGame({ seed: 7 });
    const state = game.getState();
    expect(state.phase).toBe("READY");
    expect(state.playerPile.length).toBe(26);
    expect(state.computerPile.length).toBe(26);
    const all = new Set(keys([...state.playerPile, ...state.computerPile]));
    expect(all.size).toBe(52);
  });

  test("same seed produces the same deal", () => {
    const a = new WarGame({ seed: 123 }).getState();
    const b = new WarGame({ seed: 123 }).getState();
    expect(keys(a.playerPile)).toEqual(keys(b.playerPile));
    expect(keys(a.computerPile)).toEqual(keys(b.computerPile));
  });
});

describe("warRank", () => {
  test("aces are high", () => {
    expect(warRank(card(CardName.Ace))).toBe(14);
    expect(warRank(card(CardName.King))).toBe(13);
    expect(warRank(card(CardName.Two))).toBe(2);
  });
});

describe("normal battle", () => {
  test("higher card wins and captures both to pile bottom (player card first)", () => {
    const game = new WarGame({
      deck: [
        card(CardName.King, Suit.Spades),
        card(CardName.Five, Suit.Spades),
        card(CardName.Seven, Suit.Hearts),
        card(CardName.Nine, Suit.Hearts),
      ],
      split: 2,
    });

    game.flip();
    let state = game.getState();
    expect(state.phase).toBe("BATTLE");
    expect(state.battleWinner).toBe("player");
    expect(cardKey(state.playerBattle!)).toBe(
      cardKey(card(CardName.King, Suit.Spades)),
    );
    expect(totalCards(state)).toBe(4);

    // Next flip collects the spoils to the winner's pile bottom, then battles.
    game.flip();
    state = game.getState();
    expect(state.battleWinner).toBe("computer"); // 5 vs 9
    expect(keys(state.playerPile)).toEqual(
      keys([
        card(CardName.King, Suit.Spades),
        card(CardName.Seven, Suit.Hearts),
      ]),
    );
    expect(totalCards(state)).toBe(4);
  });
});

describe("war", () => {
  test("tie triggers a war; each side buries 3 and flips a war card", () => {
    const game = new WarGame({
      deck: [
        card(CardName.King, Suit.Spades),
        card(CardName.Two, Suit.Spades),
        card(CardName.Three, Suit.Spades),
        card(CardName.Four, Suit.Spades),
        card(CardName.Nine, Suit.Spades),
        card(CardName.Six, Suit.Spades),
        card(CardName.King, Suit.Hearts),
        card(CardName.Two, Suit.Hearts),
        card(CardName.Three, Suit.Hearts),
        card(CardName.Four, Suit.Hearts),
        card(CardName.Five, Suit.Hearts),
        card(CardName.Six, Suit.Hearts),
      ],
      split: 6,
    });

    game.flip();
    let state = game.getState();
    expect(state.phase).toBe("WAR");
    expect(state.battleWinner).toBeNull();
    expect(totalCards(state)).toBe(12);

    game.flip();
    state = game.getState();
    expect(state.phase).toBe("BATTLE");
    expect(state.battleWinner).toBe("player"); // 9 beats 5
    expect(state.playerBuried).toBe(3);
    expect(state.computerBuried).toBe(3);
    expect(state.table.length).toBe(8); // 2 tied cards + 6 buried
    expect(totalCards(state)).toBe(12);

    // Collection order: player war card, computer war card, then spoils in flip order.
    game.flip();
    state = game.getState();
    expect(keys(state.playerPile)).toEqual(
      keys([
        card(CardName.Nine, Suit.Spades),
        card(CardName.Five, Suit.Hearts),
        card(CardName.King, Suit.Spades),
        card(CardName.King, Suit.Hearts),
        card(CardName.Two, Suit.Spades),
        card(CardName.Three, Suit.Spades),
        card(CardName.Four, Suit.Spades),
        card(CardName.Two, Suit.Hearts),
        card(CardName.Three, Suit.Hearts),
        card(CardName.Four, Suit.Hearts),
      ]),
    );
    expect(totalCards(state)).toBe(12);
  });

  test("side with fewer than 4 cards buries what it can and flips its last card", () => {
    const game = new WarGame({
      deck: [
        card(CardName.King, Suit.Spades),
        card(CardName.Nine, Suit.Spades),
        card(CardName.King, Suit.Hearts),
        card(CardName.Two, Suit.Hearts),
        card(CardName.Three, Suit.Hearts),
        card(CardName.Four, Suit.Hearts),
        card(CardName.Five, Suit.Hearts),
        card(CardName.Six, Suit.Hearts),
      ],
      split: 2,
    });

    game.flip(); // K vs K -> war
    expect(game.getState().phase).toBe("WAR");

    game.flip(); // player buries 0 and flips 9; computer buries 3 and flips 5
    const state = game.getState();
    expect(state.playerBuried).toBe(0);
    expect(state.computerBuried).toBe(3);
    expect(state.battleWinner).toBe("player");
    expect(totalCards(state)).toBe(8);
  });

  test("side that cannot flip a war card loses immediately", () => {
    const game = new WarGame({
      deck: [
        card(CardName.King, Suit.Spades),
        card(CardName.King, Suit.Hearts),
        card(CardName.Two, Suit.Hearts),
        card(CardName.Three, Suit.Hearts),
      ],
      split: 1,
    });

    game.flip(); // K vs K -> war, player pile now empty
    expect(game.getState().phase).toBe("WAR");

    game.flip();
    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winner).toBe("computer");
    expect(totalCards(state)).toBe(4);
  });
});

describe("game end", () => {
  test("player wins when the computer's pile empties", () => {
    const game = new WarGame({
      deck: [
        card(CardName.King, Suit.Spades),
        card(CardName.Seven, Suit.Hearts),
      ],
      split: 1,
    });

    game.flip();
    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winner).toBe("player");
    expect(state.playerPile.length).toBe(2);
    expect(state.computerPile.length).toBe(0);
  });

  test("computer wins when the player's pile empties", () => {
    const game = new WarGame({
      deck: [
        card(CardName.Seven, Suit.Hearts),
        card(CardName.King, Suit.Spades),
      ],
      split: 1,
    });

    game.flip();
    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winner).toBe("computer");
    expect(state.computerPile.length).toBe(2);
  });

  test("flip is a no-op after game over", () => {
    const game = new WarGame({
      deck: [
        card(CardName.King, Suit.Spades),
        card(CardName.Seven, Suit.Hearts),
      ],
      split: 1,
    });
    game.flip();
    const before = game.getState().playerPile.length;
    game.flip();
    expect(game.getState().playerPile.length).toBe(before);
    expect(game.getState().phase).toBe("GAME_OVER");
  });
});

describe("safety valve", () => {
  test("a cycling game ends after 2000 battles with the larger pile winning (tie -> player)", () => {
    // [3♠,2♠] vs [2♥,3♥] cycles forever with deterministic capture order.
    const game = new WarGame({
      deck: [
        card(CardName.Three, Suit.Spades),
        card(CardName.Two, Suit.Spades),
        card(CardName.Two, Suit.Hearts),
        card(CardName.Three, Suit.Hearts),
      ],
      split: 2,
    });

    for (let i = 0; i < 5000 && game.getState().phase !== "GAME_OVER"; i++) {
      game.flip();
      expect(totalCards(game.getState())).toBe(4);
    }

    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    expect(state.battleCount).toBe(2000);
    expect(state.winner).toBe("player"); // 2 vs 2 after collection -> tie goes to player
  });
});

describe("card conservation", () => {
  test("52 cards are accounted for at every step of a full seeded game", () => {
    const game = new WarGame({ seed: 42 });
    expect(totalCards(game.getState())).toBe(52);

    for (let i = 0; i < 10000 && game.getState().phase !== "GAME_OVER"; i++) {
      game.flip();
      expect(totalCards(game.getState())).toBe(52);
    }

    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winner).not.toBeNull();
    expect(totalCards(state)).toBe(52);
  });
});
