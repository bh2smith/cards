import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { PyramidGame } from "../game";
import { cardKey, cardOrder } from "../../../shared/deck";
import type { PyramidState } from "../types";

function card(rank: CardName, suit: Suit = Suit.Spades): PlayingCard {
  return new PlayingCard(rank, suit);
}

function gameWithState(overrides: Partial<PyramidState>): PyramidGame {
  const game = new PyramidGame();
  game.deal();
  const state = game.getState() as PyramidState;
  Object.assign(state, overrides);
  return game;
}

describe("PyramidGame", () => {
  test("deal produces a pyramid of 7 rows with correct sizes", () => {
    const game = new PyramidGame();
    game.deal();
    const state = game.getState();
    expect(state.pyramid.length).toBe(7);
    for (let row = 0; row < 7; row++) {
      expect(state.pyramid[row]!.length).toBe(row + 1);
    }
  });

  test("deal produces correct card counts (28 pyramid + 24 stock = 52)", () => {
    const game = new PyramidGame();
    game.deal();
    const state = game.getState();

    let pyramidCount = 0;
    for (const row of state.pyramid) {
      for (const c of row) {
        if (c !== null) pyramidCount++;
      }
    }
    expect(pyramidCount).toBe(28);
    expect(state.stock.length).toBe(24);
    expect(state.waste.length).toBe(0);
    expect(pyramidCount + state.stock.length).toBe(52);
  });

  test("deal produces no duplicate cards", () => {
    const game = new PyramidGame();
    game.deal();
    const state = game.getState();

    const allCards = [
      ...state.pyramid.flat().filter((c): c is PlayingCard => c !== null),
      ...state.stock,
    ];
    expect(allCards.length).toBe(52);

    const keys = new Set(allCards.map(cardKey));
    expect(keys.size).toBe(52);
  });

  test("deal sets phase to PLAYING", () => {
    const game = new PyramidGame();
    game.deal();
    expect(game.getState().phase).toBe("PLAYING");
  });

  test("deal sets a message", () => {
    const game = new PyramidGame();
    game.deal();
    expect(game.getState().message.length).toBeGreaterThan(0);
  });

  test("deal starts with empty waste and no selection", () => {
    const game = new PyramidGame();
    game.deal();
    const state = game.getState();
    expect(state.waste.length).toBe(0);
    expect(state.selected).toBeNull();
  });
});

describe("isExposed", () => {
  test("bottom row cards are always exposed", () => {
    const game = new PyramidGame();
    game.deal();
    for (let col = 0; col < 7; col++) {
      expect(game.isExposed(6, col)).toBe(true);
    }
  });

  test("card in row 5 is exposed when both children are null", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.King),
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Hearts),
        ],
        [
          card(CardName.Three, Suit.Hearts),
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
        ],
        [null, null, card(CardName.Nine, Suit.Hearts), null, null, null, null],
      ],
    });
    expect(game.isExposed(5, 0)).toBe(true);
  });

  test("card in row 5 is NOT exposed when one child remains", () => {
    const game = new PyramidGame();
    game.deal();
    expect(game.isExposed(5, 0)).toBe(false);
  });

  test("removed card is never exposed", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.King),
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Hearts),
        ],
        [
          card(CardName.Three, Suit.Hearts),
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
        ],
        [null, null, null, null, null, null, null],
      ],
    });
    expect(game.isExposed(6, 0)).toBe(false);
  });
});

describe("selectCard", () => {
  test("selecting an exposed King removes it immediately", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.King),
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Hearts),
        ],
        [
          card(CardName.Three, Suit.Hearts),
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
        ],
        [
          card(CardName.Nine, Suit.Hearts),
          card(CardName.Ten, Suit.Hearts),
          card(CardName.Jack, Suit.Hearts),
          card(CardName.Queen, Suit.Hearts),
          card(CardName.King, Suit.Hearts),
          card(CardName.Ace, Suit.Diamonds),
          card(CardName.Two, Suit.Diamonds),
        ],
      ],
      stock: [],
    });
    game.selectCard(6, 4);
    expect(game.getState().pyramid[6]![4]).toBeNull();
    expect(game.getState().selected).toBeNull();
  });

  test("selecting an exposed non-King sets selection", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.Two, Suit.Hearts),
          card(CardName.Three, Suit.Hearts),
          card(CardName.Four, Suit.Hearts),
        ],
        [
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
          card(CardName.Nine, Suit.Hearts),
          card(CardName.Ten, Suit.Hearts),
        ],
        [
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Diamonds),
          card(CardName.Three, Suit.Diamonds),
          card(CardName.Four, Suit.Diamonds),
          card(CardName.Five, Suit.Diamonds),
          card(CardName.Six, Suit.Diamonds),
          card(CardName.Seven, Suit.Diamonds),
        ],
      ],
      stock: [],
    });
    game.selectCard(6, 0);
    const state = game.getState();
    expect(state.selected).toEqual([6, 0]);
  });

  test("selecting the same card twice clears selection", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Hearts),
          card(CardName.Three, Suit.Hearts),
        ],
        [
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
          card(CardName.Nine, Suit.Hearts),
        ],
        [
          card(CardName.Ten, Suit.Hearts),
          card(CardName.Jack, Suit.Hearts),
          card(CardName.Queen, Suit.Hearts),
          card(CardName.Two, Suit.Diamonds),
          card(CardName.Three, Suit.Diamonds),
          card(CardName.Four, Suit.Diamonds),
          card(CardName.Five, Suit.Diamonds),
        ],
      ],
      stock: [],
    });
    game.selectCard(6, 0);
    expect(game.getState().selected).toEqual([6, 0]);
    game.selectCard(6, 0);
    expect(game.getState().selected).toBeNull();
  });

  test("selecting two exposed cards that sum to 13 removes both", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Hearts),
          card(CardName.Three, Suit.Hearts),
        ],
        [
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
          card(CardName.Nine, Suit.Hearts),
        ],
        [
          card(CardName.Six, Suit.Diamonds),
          card(CardName.Seven, Suit.Diamonds),
          card(CardName.Eight, Suit.Diamonds),
          card(CardName.Nine, Suit.Diamonds),
          card(CardName.Ten, Suit.Diamonds),
          card(CardName.Jack, Suit.Diamonds),
          card(CardName.Two, Suit.Diamonds),
        ],
      ],
      stock: [],
    });
    // 6 + 7 = 13
    game.selectCard(6, 0);
    game.selectCard(6, 1);
    expect(game.getState().pyramid[6]![0]).toBeNull();
    expect(game.getState().pyramid[6]![1]).toBeNull();
    expect(game.getState().selected).toBeNull();
  });

  test("selecting two cards that do NOT sum to 13 switches selection", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Hearts),
          card(CardName.Three, Suit.Hearts),
        ],
        [
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
          card(CardName.Nine, Suit.Hearts),
        ],
        [
          card(CardName.Six, Suit.Diamonds),
          card(CardName.Eight, Suit.Diamonds),
          card(CardName.Nine, Suit.Diamonds),
          card(CardName.Ten, Suit.Diamonds),
          card(CardName.Ten, Suit.Hearts),
          card(CardName.Jack, Suit.Diamonds),
          card(CardName.Two, Suit.Diamonds),
        ],
      ],
      stock: [],
    });
    // 6 + 8 = 14, not 13
    game.selectCard(6, 0);
    game.selectCard(6, 1);
    expect(game.getState().selected).toEqual([6, 1]);
  });
});

describe("selectWaste", () => {
  test("selecting waste King removes it", () => {
    const game = gameWithState({
      waste: [card(CardName.King)],
    });
    game.selectWaste();
    expect(game.getState().waste.length).toBe(0);
    expect(game.getState().selected).toBeNull();
  });

  test("selecting waste with no prior selection sets selected to waste", () => {
    const game = gameWithState({
      waste: [card(CardName.Five)],
    });
    game.selectWaste();
    expect(game.getState().selected).toBe("waste");
  });

  test("selecting waste twice clears selection", () => {
    const game = gameWithState({
      waste: [card(CardName.Five)],
    });
    game.selectWaste();
    expect(game.getState().selected).toBe("waste");
    game.selectWaste();
    expect(game.getState().selected).toBeNull();
  });

  test("pairing pyramid card with waste when they sum to 13", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Hearts),
          card(CardName.Three, Suit.Hearts),
        ],
        [
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
          card(CardName.Nine, Suit.Hearts),
        ],
        [
          card(CardName.Six, Suit.Diamonds),
          card(CardName.Seven, Suit.Diamonds),
          card(CardName.Eight, Suit.Diamonds),
          card(CardName.Nine, Suit.Diamonds),
          card(CardName.Ten, Suit.Diamonds),
          card(CardName.Jack, Suit.Diamonds),
          card(CardName.Two, Suit.Diamonds),
        ],
      ],
      waste: [card(CardName.Queen, Suit.Diamonds)],
      stock: [],
    });
    // Select Ace (row 6, col 6 → value 2? No... col 6 is Two of Diamonds, value 2)
    // Actually Queen=12, Ace=1 → 12+1=13. Let's select pyramid card first, then waste
    game.selectCard(6, 0); // 6 of Diamonds (value 6)
    // 6 + 12 = 18, no match. Let me use a proper pair.
    // Reset: select Two of Diamonds (value 2) at col 6, waste is Queen (value 12)
    // 2 + 12 = 14, not 13 either.
    // Let me just use Ace at position [0,0] but it's not exposed.
    // Use a simpler setup.
    const game2 = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [null, null],
        [null, null, null],
        [null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
      ],
      waste: [card(CardName.Queen, Suit.Diamonds)],
      stock: [],
    });
    // Ace is exposed (all children null). Ace=1, Queen=12, sum=13
    game2.selectCard(0, 0);
    expect(game2.getState().selected).toEqual([0, 0]);
    game2.selectWaste();
    expect(game2.getState().pyramid[0]![0]).toBeNull();
    expect(game2.getState().waste.length).toBe(0);
    expect(game2.getState().selected).toBeNull();
  });
});

describe("drawStock", () => {
  test("drawing from stock moves card to waste", () => {
    const game = new PyramidGame();
    game.deal();
    const state = game.getState();
    const stockLen = state.stock.length;
    const topStock = state.stock[state.stock.length - 1]!;

    game.drawStock();

    expect(game.getState().stock.length).toBe(stockLen - 1);
    expect(game.getState().waste.length).toBe(1);
    expect(cardKey(game.getState().waste[0]!)).toBe(cardKey(topStock));
  });

  test("drawing clears selection", () => {
    const game = new PyramidGame();
    game.deal();
    game.selectCard(6, 0);
    game.drawStock();
    expect(game.getState().selected).toBeNull();
  });

  test("cannot draw from empty stock", () => {
    const game = gameWithState({ stock: [] });
    const wasteBefore = game.getState().waste.length;
    game.drawStock();
    expect(game.getState().waste.length).toBe(wasteBefore);
  });
});

describe("hasAnyMove", () => {
  test("returns true when stock is non-empty", () => {
    const game = new PyramidGame();
    game.deal();
    expect(game.hasAnyMove()).toBe(true);
  });

  test("returns true when an exposed King exists", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Hearts),
          card(CardName.Three, Suit.Hearts),
        ],
        [
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
          card(CardName.Nine, Suit.Hearts),
        ],
        [
          card(CardName.Ten, Suit.Hearts),
          card(CardName.Jack, Suit.Hearts),
          card(CardName.Queen, Suit.Hearts),
          card(CardName.King),
          card(CardName.Two, Suit.Diamonds),
          card(CardName.Three, Suit.Diamonds),
          card(CardName.Four, Suit.Diamonds),
        ],
      ],
      stock: [],
      waste: [],
    });
    expect(game.hasAnyMove()).toBe(true);
  });

  test("returns false when no moves remain", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Hearts),
          card(CardName.Three, Suit.Hearts),
        ],
        [
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
          card(CardName.Nine, Suit.Hearts),
        ],
        [
          card(CardName.Two, Suit.Diamonds),
          card(CardName.Two, Suit.Hearts),
          card(CardName.Three, Suit.Diamonds),
          card(CardName.Three, Suit.Hearts),
          card(CardName.Four, Suit.Diamonds),
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Diamonds),
        ],
      ],
      stock: [],
      waste: [card(CardName.Five, Suit.Hearts)],
    });
    expect(game.hasAnyMove()).toBe(false);
  });
});

describe("end conditions", () => {
  test("win when last pyramid card is removed", () => {
    const game = gameWithState({
      pyramid: [
        [null],
        [null, null],
        [null, null, null],
        [null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null, null],
        [null, null, null, null, null, null, card(CardName.King)],
      ],
      stock: [],
      waste: [],
    });
    game.selectCard(6, 6);
    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    expect(state.won).toBe(true);
  });

  test("loss when no moves remain after draw", () => {
    const game = gameWithState({
      pyramid: [
        [card(CardName.Ace)],
        [card(CardName.Two), card(CardName.Three)],
        [card(CardName.Four), card(CardName.Five), card(CardName.Six)],
        [
          card(CardName.Seven),
          card(CardName.Eight),
          card(CardName.Nine),
          card(CardName.Ten),
        ],
        [
          card(CardName.Jack),
          card(CardName.Queen),
          card(CardName.Ace, Suit.Hearts),
          card(CardName.Two, Suit.Hearts),
          card(CardName.Three, Suit.Hearts),
        ],
        [
          card(CardName.Four, Suit.Hearts),
          card(CardName.Five, Suit.Hearts),
          card(CardName.Six, Suit.Hearts),
          card(CardName.Seven, Suit.Hearts),
          card(CardName.Eight, Suit.Hearts),
          card(CardName.Nine, Suit.Hearts),
        ],
        [
          card(CardName.Two, Suit.Diamonds),
          card(CardName.Two, Suit.Clubs),
          card(CardName.Three, Suit.Diamonds),
          card(CardName.Three, Suit.Clubs),
          card(CardName.Four, Suit.Diamonds),
          card(CardName.Four, Suit.Clubs),
          card(CardName.Five, Suit.Diamonds),
        ],
      ],
      stock: [card(CardName.Five, Suit.Hearts)],
      waste: [],
    });
    game.drawStock();
    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    expect(state.won).toBe(false);
  });
});
