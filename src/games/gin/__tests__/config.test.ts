import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { GinRummyGame, applyHollywoodWin, emptyHollywood } from "../game";
import { GIN_FAMILY, ginRunOptions, resolveKnockThreshold } from "../config";
import { resolvePreset } from "../../../shared/engine/variant";
import { calculateDeadwood, findAllRuns } from "../melds";
import type { GinState } from "../types";

function card(rank: CardName, suit: Suit = Suit.Spades): PlayingCard {
  return new PlayingCard(rank, suit);
}

/** A gin hand (deadwood 0 under base rules) plus one junk card at index 10. */
const GIN_HAND = [
  card(CardName.Ace, Suit.Spades),
  card(CardName.Two, Suit.Spades),
  card(CardName.Three, Suit.Spades),
  card(CardName.Four, Suit.Hearts),
  card(CardName.Four, Suit.Diamonds),
  card(CardName.Four, Suit.Clubs),
  card(CardName.Ten, Suit.Hearts),
  card(CardName.Jack, Suit.Hearts),
  card(CardName.Queen, Suit.Hearts),
  card(CardName.King, Suit.Hearts),
];

/** Meldless defender hand worth 70 deadwood with no layoffs onto GIN_HAND. */
const DEFENDER_HAND = [
  card(CardName.Two, Suit.Diamonds),
  card(CardName.Five, Suit.Clubs),
  card(CardName.Seven, Suit.Diamonds),
  card(CardName.Nine, Suit.Clubs),
  card(CardName.Jack, Suit.Diamonds),
  card(CardName.King, Suit.Clubs),
  card(CardName.Three, Suit.Hearts),
  card(CardName.Six, Suit.Spades),
  card(CardName.Eight, Suit.Diamonds),
  card(CardName.Queen, Suit.Spades),
];

/** Put the game into a player DISCARDING state with fixed hands and upcard. */
function forceDiscarding(
  game: GinRummyGame,
  playerHand: PlayingCard[],
  overrides: Partial<GinState> = {},
): GinState {
  const state = game.getState() as GinState;
  state.phase = "DISCARDING";
  state.currentTurn = "player";
  state.playerHand = [...playerHand];
  state.computerHand = [...DEFENDER_HAND];
  Object.assign(state, overrides);
  return state;
}

describe("preset resolution", () => {
  test("base config is classic gin rummy", () => {
    const cfg = resolvePreset(GIN_FAMILY);
    expect(cfg.knockThreshold).toBe(10);
    expect(cfg.ginBonus).toBe(25);
    expect(cfg.undercutBonus).toBe(25);
    expect(cfg.targetScore).toBe(100);
    expect(cfg.roundTheCorner).toBe(false);
    expect(cfg.spadeUpcardDoubles).toBe(false);
    expect(cfg.hollywood).toBe(false);
  });

  test("oklahoma derives the knock cap from the upcard and doubles on spades", () => {
    const cfg = resolvePreset(GIN_FAMILY, "oklahoma");
    expect(typeof cfg.knockThreshold).toBe("function");
    expect(cfg.spadeUpcardDoubles).toBe(true);
    expect(resolveKnockThreshold(cfg, card(CardName.Seven, Suit.Hearts))).toBe(
      7,
    );
    expect(resolveKnockThreshold(cfg, card(CardName.King, Suit.Clubs))).toBe(
      10,
    );
    expect(resolveKnockThreshold(cfg, card(CardName.Ace, Suit.Hearts))).toBe(0);
  });

  test("round-the-corner enables wrapping runs only", () => {
    const cfg = resolvePreset(GIN_FAMILY, "round-the-corner");
    expect(cfg.roundTheCorner).toBe(true);
    expect(cfg.knockThreshold).toBe(10);
    expect(ginRunOptions(cfg).roundTheCorner).toBe(true);
  });

  test("hollywood keeps base play rules", () => {
    const cfg = resolvePreset(GIN_FAMILY, "hollywood");
    expect(cfg.hollywood).toBe(true);
    expect(cfg.knockThreshold).toBe(10);
    expect(cfg.roundTheCorner).toBe(false);
  });

  test("base and non-hollywood presets carry no hollywood state", () => {
    expect(new GinRummyGame().getState().hollywood).toBeNull();
    expect(new GinRummyGame("oklahoma").getState().hollywood).toBeNull();
  });
});

describe("deal exposes the initial upcard", () => {
  test("initial upcard is the first discard", () => {
    const game = new GinRummyGame();
    const state = game.getState();
    expect(state.initialUpcard).not.toBeNull();
    expect(state.discardPile[0]).toBe(state.initialUpcard!);
    expect(state.knockThreshold).toBe(10);
  });

  test("oklahoma resolves the round's knock cap from the dealt upcard", () => {
    const game = new GinRummyGame("oklahoma");
    const state = game.getState();
    expect(state.knockThreshold).toBe(
      resolveKnockThreshold(game.getConfig(), state.initialUpcard!),
    );
  });
});

describe("oklahoma", () => {
  test("knock cap follows the upcard pip value", () => {
    const game = new GinRummyGame("oklahoma");
    // Deadwood after discarding the junk queen: A(1) + 2 + 3 = 6.
    const hand = [
      card(CardName.Ace, Suit.Clubs),
      card(CardName.Two, Suit.Diamonds),
      card(CardName.Three, Suit.Clubs),
      card(CardName.Four, Suit.Hearts),
      card(CardName.Four, Suit.Diamonds),
      card(CardName.Four, Suit.Clubs),
      card(CardName.Ten, Suit.Hearts),
      card(CardName.Jack, Suit.Hearts),
      card(CardName.Queen, Suit.Hearts),
      card(CardName.King, Suit.Hearts),
      card(CardName.Queen, Suit.Diamonds),
    ];
    forceDiscarding(game, hand, {
      initialUpcard: card(CardName.Five, Suit.Hearts),
      knockThreshold: 5,
    });
    // Deadwood 6 > cap 5: the knock is refused.
    expect(game.playerKnock(10)).toBe(false);
    expect(game.getState().playerHand.length).toBe(11);

    forceDiscarding(game, hand, {
      initialUpcard: card(CardName.Seven, Suit.Hearts),
      knockThreshold: 7,
    });
    expect(game.playerKnock(10)).toBe(true);
  });

  test("ace upcard makes the round gin-only", () => {
    const game = new GinRummyGame("oklahoma");
    // One point of deadwood (the club ace) — not gin.
    const nearGin = [...GIN_HAND];
    nearGin[0] = card(CardName.Ace, Suit.Clubs);
    forceDiscarding(game, [...nearGin, card(CardName.Nine, Suit.Diamonds)], {
      initialUpcard: card(CardName.Ace, Suit.Hearts),
      knockThreshold: 0,
    });
    expect(game.canPlayerKnock()).toBe(false);
    expect(game.playerKnock(10)).toBe(false);

    forceDiscarding(game, [...GIN_HAND, card(CardName.Nine, Suit.Diamonds)], {
      initialUpcard: card(CardName.Ace, Suit.Hearts),
      knockThreshold: 0,
    });
    expect(game.playerKnock(10)).toBe(true);
    expect(game.getState().knockResult!.isGin).toBe(true);
  });

  test("spade upcard doubles the round score", () => {
    const plain = new GinRummyGame("oklahoma");
    forceDiscarding(plain, [...GIN_HAND, card(CardName.Nine, Suit.Diamonds)], {
      initialUpcard: card(CardName.Seven, Suit.Hearts),
      knockThreshold: 7,
    });
    expect(plain.playerKnock(10)).toBe(true);
    // Gin bonus 25 + 70 defender deadwood.
    expect(plain.getState().knockResult!.roundPoints).toBe(95);

    const doubled = new GinRummyGame("oklahoma");
    forceDiscarding(
      doubled,
      [...GIN_HAND, card(CardName.Nine, Suit.Diamonds)],
      {
        initialUpcard: card(CardName.Seven, Suit.Spades),
        knockThreshold: 7,
      },
    );
    expect(doubled.playerKnock(10)).toBe(true);
    expect(doubled.getState().knockResult!.roundPoints).toBe(190);
    expect(doubled.getState().playerScore).toBe(190);
  });

  test("base games never double on spade upcards", () => {
    const game = new GinRummyGame();
    forceDiscarding(game, [...GIN_HAND, card(CardName.Nine, Suit.Diamonds)], {
      initialUpcard: card(CardName.Seven, Suit.Spades),
    });
    expect(game.playerKnock(10)).toBe(true);
    expect(game.getState().knockResult!.roundPoints).toBe(95);
  });
});

describe("round-the-corner", () => {
  const wrapRun = [
    card(CardName.King, Suit.Spades),
    card(CardName.Ace, Suit.Spades),
    card(CardName.Two, Suit.Spades),
  ];

  test("K-A-2 is a run only with the option on", () => {
    expect(findAllRuns(wrapRun)).toHaveLength(0);
    const runs = findAllRuns(wrapRun, { minLength: 3, roundTheCorner: true });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.cards).toHaveLength(3);
  });

  test("Q-K-A is a run with the option on", () => {
    const hand = [
      card(CardName.Queen, Suit.Hearts),
      card(CardName.King, Suit.Hearts),
      card(CardName.Ace, Suit.Hearts),
    ];
    expect(findAllRuns(hand)).toHaveLength(0);
    expect(
      findAllRuns(
        hand,
        ginRunOptions(resolvePreset(GIN_FAMILY, "round-the-corner")),
      ),
    ).toHaveLength(1);
  });

  test("wrapping run reduces deadwood (ace still counts 1 when unmelded)", () => {
    const hand = [...wrapRun, card(CardName.Nine, Suit.Diamonds)];
    // Base: A-2 alone, K and 9 loose → 10 + 1 + 2 + 9 = 22.
    expect(calculateDeadwood(hand)).toBe(22);
    // Wrapped: K-A-2 melds, only the 9 remains.
    expect(
      calculateDeadwood(hand, { minLength: 3, roundTheCorner: true }),
    ).toBe(9);
  });

  test("game accepts a knock built on a K-A-2 run", () => {
    const ginHand = [
      ...wrapRun,
      card(CardName.Five, Suit.Hearts),
      card(CardName.Five, Suit.Diamonds),
      card(CardName.Five, Suit.Clubs),
      card(CardName.Eight, Suit.Hearts),
      card(CardName.Eight, Suit.Diamonds),
      card(CardName.Eight, Suit.Clubs),
      card(CardName.Five, Suit.Spades),
    ];
    const junk = card(CardName.Queen, Suit.Diamonds);

    const rtc = new GinRummyGame("round-the-corner");
    forceDiscarding(rtc, [...ginHand, junk]);
    expect(rtc.playerKnock(10)).toBe(true);
    expect(rtc.getState().knockResult!.isGin).toBe(true);

    // The same hand is 13 deadwood under base rules — no knock.
    const base = new GinRummyGame();
    forceDiscarding(base, [...ginHand, junk]);
    expect(base.playerKnock(10)).toBe(false);
  });
});

describe("hollywood", () => {
  test("game starts with three open, empty columns", () => {
    const state = new GinRummyGame("hollywood").getState();
    expect(state.hollywood).not.toBeNull();
    expect(state.hollywood!.columns).toHaveLength(3);
    for (const col of state.hollywood!.columns) {
      expect(col.playerScore).toBe(0);
      expect(col.computerScore).toBe(0);
      expect(col.closed).toBe(false);
      expect(col.winner).toBeNull();
    }
  });

  test("first, second and third wins land in columns 1, 1-2 and 1-3", () => {
    const hw = emptyHollywood();
    applyHollywoodWin(hw, "player", 20, 100);
    expect(hw.columns.map((c) => c.playerScore)).toEqual([20, 0, 0]);

    applyHollywoodWin(hw, "computer", 30, 100);
    expect(hw.columns.map((c) => c.computerScore)).toEqual([30, 0, 0]);

    applyHollywoodWin(hw, "player", 10, 100);
    expect(hw.columns.map((c) => c.playerScore)).toEqual([30, 10, 0]);

    applyHollywoodWin(hw, "player", 15, 100);
    expect(hw.columns.map((c) => c.playerScore)).toEqual([45, 25, 15]);
    expect(hw.playerWins).toBe(3);
    expect(hw.computerWins).toBe(1);
  });

  test("a column closes at the target and stops accepting entries", () => {
    const hw = emptyHollywood();
    hw.playerWins = 3; // subsequent wins enter all columns
    hw.columns[0]!.playerScore = 90;
    applyHollywoodWin(hw, "player", 60, 100);
    expect(hw.columns[0]!.closed).toBe(true);
    expect(hw.columns[0]!.winner).toBe("player");
    expect(hw.columns[0]!.playerScore).toBe(150);
    expect(hw.columns[1]!.closed).toBe(false);

    applyHollywoodWin(hw, "player", 50, 100);
    // Column 1 unchanged after closing; columns 2 and 3 keep filling.
    expect(hw.columns[0]!.playerScore).toBe(150);
    expect(hw.columns[1]!.playerScore).toBe(110);
    expect(hw.columns[1]!.closed).toBe(true);
    expect(hw.columns[2]!.playerScore).toBe(110);
    expect(hw.columns[2]!.closed).toBe(true);
  });

  test("round win updates columns through real play", () => {
    const game = new GinRummyGame("hollywood");
    forceDiscarding(game, [...GIN_HAND, card(CardName.Nine, Suit.Diamonds)]);
    expect(game.playerKnock(10)).toBe(true);

    const state = game.getState();
    expect(state.phase).toBe("ROUND_OVER");
    expect(state.hollywood!.playerWins).toBe(1);
    expect(state.hollywood!.columns[0]!.playerScore).toBe(95);
    expect(state.hollywood!.columns[1]!.playerScore).toBe(0);
    // Aggregate mirrors into the classic score field.
    expect(state.playerScore).toBe(95);
  });

  test("match ends when all three columns close; aggregate decides", () => {
    const game = new GinRummyGame("hollywood");
    const state = forceDiscarding(game, [
      ...GIN_HAND,
      card(CardName.Nine, Suit.Diamonds),
    ]);
    state.hollywood!.playerWins = 2; // this win enters all three columns
    for (const col of state.hollywood!.columns) col.playerScore = 99;
    state.hollywood!.columns[0]!.computerScore = 40;

    expect(game.playerKnock(10)).toBe(true);
    const final = game.getState();
    expect(final.hollywood!.columns.every((c) => c.closed)).toBe(true);
    expect(final.phase).toBe("GAME_OVER");
    expect(final.winner).toBe("player");
    expect(final.playerScore).toBe(3 * (99 + 95));
    expect(final.computerScore).toBe(40);
  });
});
