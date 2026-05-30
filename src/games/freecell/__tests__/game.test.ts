import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { FreecellGame } from "../game";
import type { FreecellState } from "../types";
import { cardKey } from "../../../shared/deck";

function card(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

function mut(game: FreecellGame): FreecellState {
  return game.getState() as FreecellState;
}

const RANKS = [
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
  CardName.King,
];

// Foundation index order used by the engine.
const F = { Clubs: 0, Spades: 1, Diamonds: 2, Hearts: 3 };

function emptyBoard(game: FreecellGame): FreecellState {
  const s = mut(game);
  s.phase = "PLAYING";
  s.tableau = [[], [], [], [], [], [], [], []];
  s.freeCells = [null, null, null, null];
  s.foundations = [[], [], [], []];
  s.selected = null;
  s.moves = 0;
  return s;
}

describe("deal", () => {
  test("deals 52 cards into 8 columns, no duplicates", () => {
    const s = new FreecellGame(42).getState();
    expect(s.tableau.length).toBe(8);
    const all = [
      ...s.tableau.flat(),
      ...s.freeCells.filter(Boolean),
      ...s.foundations.flat(),
    ] as PlayingCard[];
    expect(all.length).toBe(52);
    expect(new Set(all.map(cardKey)).size).toBe(52);
    expect(s.freeCells.every((c) => c === null)).toBe(true);
    expect(s.dealNumber).toBe(42);
  });
});

describe("foundations", () => {
  test("plays an ace from the tableau onto its foundation", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.tableau[0] = [card(CardName.Ace, Suit.Clubs)];

    game.selectTableau(0, 0);
    game.selectFoundation(F.Clubs);

    expect(s.foundations[F.Clubs]!.length).toBe(1);
    expect(s.tableau[0]!.length).toBe(0);
    expect(s.moves).toBe(1);
  });

  test("rejects a non-sequential foundation play", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.tableau[0] = [card(CardName.Three, Suit.Clubs)];

    game.selectTableau(0, 0);
    game.selectFoundation(F.Clubs); // no Ace/Two yet
    expect(s.foundations[F.Clubs]!.length).toBe(0);
  });
});

describe("tableau moves", () => {
  test("moves a single card onto an alternating-color, one-higher card", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.tableau[0] = [card(CardName.Six, Suit.Hearts)];
    s.tableau[1] = [card(CardName.Seven, Suit.Spades)];

    game.selectTableau(0, 0);
    game.selectTableau(1, 0); // drop 6♥ onto 7♠
    expect(s.tableau[0]!.length).toBe(0);
    expect(s.tableau[1]!.map(cardKey)).toEqual([
      cardKey(card(CardName.Seven, Suit.Spades)),
      cardKey(card(CardName.Six, Suit.Hearts)),
    ]);
  });

  test("moves a valid run as a supermove", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.tableau[0] = [
      card(CardName.King, Suit.Spades),
      card(CardName.Queen, Suit.Hearts),
      card(CardName.Jack, Suit.Spades),
    ];
    s.tableau[1] = [card(CardName.King, Suit.Clubs)];

    game.selectTableau(0, 1); // pick up Q♥ + J♠
    game.selectTableau(1, 0); // onto K♣
    expect(s.tableau[0]!.length).toBe(1);
    expect(s.tableau[1]!.length).toBe(3);
  });

  test("does not select a non-sequential run", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.tableau[0] = [
      card(CardName.King, Suit.Spades),
      card(CardName.Five, Suit.Hearts), // not a run with King
    ];
    game.selectTableau(0, 0);
    expect(s.selected).toBeNull();
  });
});

describe("supermove limits", () => {
  test("(free+1) * 2^empty, with destination empties excluded", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    // fill all 8 columns so none are empty
    for (let i = 0; i < 8; i++)
      s.tableau[i] = [card(CardName.King, Suit.Spades)];

    expect(game.maxSupermove(false)).toBe(5); // 4 free cells, 0 empty cols

    s.freeCells[0] = card(CardName.Ace, Suit.Clubs);
    expect(game.maxSupermove(false)).toBe(4); // 3 free

    s.freeCells = [null, null, null, null];
    s.tableau[7] = []; // one empty column
    expect(game.maxSupermove(false)).toBe(10); // (5) * 2^1
    expect(game.maxSupermove(true)).toBe(5); // moving onto the empty col: 2^0
  });

  test("rejects a run longer than the supermove limit", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    // 0 free cells, 0 empty cols → max 1
    s.freeCells = [
      card(CardName.Ace, Suit.Clubs),
      card(CardName.Two, Suit.Clubs),
      card(CardName.Three, Suit.Clubs),
      card(CardName.Four, Suit.Clubs),
    ];
    for (let i = 2; i < 8; i++)
      s.tableau[i] = [card(CardName.King, Suit.Spades)];
    s.tableau[0] = [
      card(CardName.Five, Suit.Spades),
      card(CardName.Four, Suit.Hearts),
    ];
    s.tableau[1] = [card(CardName.Six, Suit.Hearts)];

    game.selectTableau(0, 0); // run of 2
    game.selectTableau(1, 0); // onto 6♥ — needs to move 2, limit is 1
    expect(s.tableau[0]!.length).toBe(2); // unchanged
  });
});

describe("free cells", () => {
  test("moves a card into an empty free cell and back out", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.tableau[0] = [card(CardName.Nine, Suit.Hearts)];

    game.selectTableau(0, 0);
    game.selectFreeCell(0);
    expect(s.freeCells[0]).not.toBeNull();
    expect(s.tableau[0]!.length).toBe(0);

    game.selectFreeCell(0); // select it again
    s.tableau[1] = [card(CardName.Ten, Suit.Spades)];
    game.selectTableau(1, 0); // 9♥ onto 10♠
    expect(s.freeCells[0]).toBeNull();
    expect(s.tableau[1]!.length).toBe(2);
  });

  test("cannot drop a multi-card run into a free cell", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.tableau[0] = [
      card(CardName.Seven, Suit.Spades),
      card(CardName.Six, Suit.Hearts),
    ];
    game.selectTableau(0, 0); // run of 2
    game.selectFreeCell(0);
    expect(s.freeCells[0]).toBeNull();
    expect(s.tableau[0]!.length).toBe(2);
  });
});

describe("undo", () => {
  test("reverts the last move and the move count", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.tableau[0] = [card(CardName.Ace, Suit.Clubs)];

    game.selectTableau(0, 0);
    game.selectFoundation(F.Clubs);
    expect(game.foundationCount()).toBe(1);
    expect(s.moves).toBe(1);

    expect(game.canUndo()).toBe(true);
    game.undo();
    expect(game.foundationCount()).toBe(0);
    expect(s.tableau[0]!.length).toBe(1);
    expect(s.moves).toBe(0);
  });
});

describe("restart", () => {
  test("re-deals the same number and clears progress", () => {
    const game = new FreecellGame(777);
    const before = game.getState().tableau.map((c) => c.map(cardKey).join());
    const s = emptyBoard(game);
    s.moves = 9;

    game.restart();
    const after = game.getState().tableau.map((c) => c.map(cardKey).join());
    expect(after).toEqual(before);
    expect(game.getState().dealNumber).toBe(777);
    expect(game.getState().moves).toBe(0);
    expect(game.canUndo()).toBe(false);
  });
});

describe("win + auto-complete", () => {
  function fullPile(suit: Suit, upto = 13): PlayingCard[] {
    return RANKS.slice(0, upto).map((r) => card(r, suit));
  }

  test("placing the final card wins the game", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.foundations = [
      fullPile(Suit.Clubs),
      fullPile(Suit.Spades),
      fullPile(Suit.Diamonds),
      fullPile(Suit.Hearts, 12), // hearts missing King
    ];
    s.tableau[0] = [card(CardName.King, Suit.Hearts)];

    game.selectTableau(0, 0);
    game.selectFoundation(F.Hearts);
    expect(game.getState().phase).toBe("GAME_OVER");
    expect(game.getState().won).toBe(true);
  });

  test("canAutoComplete is true when only foundation moves remain", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.foundations = [
      fullPile(Suit.Clubs, 11), // clubs up to Jack
      fullPile(Suit.Spades),
      fullPile(Suit.Diamonds),
      fullPile(Suit.Hearts),
    ];
    s.tableau[0] = [
      card(CardName.King, Suit.Clubs),
      card(CardName.Queen, Suit.Clubs),
    ];
    expect(game.canAutoComplete()).toBe(true);

    let steps = 0;
    while (game.autoCompleteStep()) steps++;
    expect(steps).toBe(2);
    expect(game.getState().won).toBe(true);
  });

  test("canAutoComplete is false when a needed card is buried", () => {
    const game = new FreecellGame(1);
    const s = emptyBoard(game);
    s.foundations = [
      fullPile(Suit.Clubs, 11),
      fullPile(Suit.Spades),
      fullPile(Suit.Diamonds),
      fullPile(Suit.Hearts),
    ];
    // Queen needed next, but it's buried under the King.
    s.tableau[0] = [
      card(CardName.Queen, Suit.Clubs),
      card(CardName.King, Suit.Clubs),
    ];
    expect(game.canAutoComplete()).toBe(false);
  });
});
