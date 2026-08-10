import { test, expect, describe, beforeEach } from "bun:test";
import { CardName, Suit } from "typedeck";
import type { PlayingCard } from "typedeck";
import { BlackjackGame, shouldDealerHit } from "../game";
import { BLACKJACK_FAMILY } from "../config";
import { resolvePreset } from "../../../shared/engine/variant";
import { cardKey } from "../../../shared/deck";
import {
  resetBankrollForTests,
  getBankroll,
  adjustBankroll,
} from "../../../shared/engine/bankroll";

function card(name: CardName, suit = Suit.Spades): PlayingCard {
  return { cardName: name, suit } as PlayingCard;
}

/** Pin the shared bankroll to an exact value, consuming the daily top-up. */
function setBankroll(n: number): void {
  adjustBankroll(-getBankroll());
  getBankroll();
  adjustBankroll(n - getBankroll());
}

beforeEach(() => resetBankrollForTests());

const A = card(CardName.Ace);
const K = card(CardName.King);
const Q = card(CardName.Queen);
const J = card(CardName.Jack);
const N = card(CardName.Nine);
const E = card(CardName.Eight);
const S = card(CardName.Seven);
const X = card(CardName.Six);
const F = card(CardName.Five);
const R = card(CardName.Four);

// The engine's state is intentionally crafted in these tests, exactly like
// the #104 regression test: getState() returns the live object.
type Craftable = {
  phase: string;
  playerHand: PlayingCard[];
  splitHand: PlayingCard[] | null;
  dealerHand: PlayingCard[];
  activeHand: 0 | 1;
  bet: number;
  roundResult: string | null;
  splitResult: string | null;
};
function craft(g: BlackjackGame): Craftable {
  return g.getState() as unknown as Craftable;
}
function injectDeck(g: BlackjackGame, cards: PlayingCard[]): void {
  (g as unknown as { deck: PlayingCard[] }).deck = cards;
}

describe("preset resolution", () => {
  test("base is the current house rules", () => {
    const base = resolvePreset(BLACKJACK_FAMILY, undefined);
    expect(base).toEqual({
      decks: 1,
      dealerHitsSoft17: true,
      doubleOn: "8-11",
      surrender: false,
      blackjackPays: 1.5,
      resplit: false,
    });
  });

  test("presets override exactly one rule each", () => {
    expect(resolvePreset(BLACKJACK_FAMILY, "s17").dealerHitsSoft17).toBe(false);
    expect(resolvePreset(BLACKJACK_FAMILY, "six-deck").decks).toBe(6);
    expect(resolvePreset(BLACKJACK_FAMILY, "surrender").surrender).toBe(true);
    expect(resolvePreset(BLACKJACK_FAMILY, "tight-double").doubleOn).toBe(
      "10-11",
    );
  });

  test("unknown preset id falls back to base", () => {
    expect(resolvePreset(BLACKJACK_FAMILY, "nope")).toEqual(
      BLACKJACK_FAMILY.base,
    );
  });
});

describe("S17 dealer", () => {
  function gameAtDealerTurn(
    presetId: string | undefined,
    dealer: PlayingCard[],
  ): BlackjackGame {
    const g = new BlackjackGame(presetId);
    const s = craft(g);
    s.phase = "PLAYER_TURN";
    s.dealerHand = dealer;
    g.beginDealerTurn();
    return g;
  }

  test("shouldDealerHit stands on soft 17 when hitsSoft17 is false", () => {
    expect(shouldDealerHit([A, X], false)).toBe(false);
    expect(shouldDealerHit([A, X], true)).toBe(true);
  });

  test("s17 dealer stands on A+6", () => {
    const g = gameAtDealerTurn("s17", [A, X]);
    expect(g.dealerDrawOne()).toBe(false);
  });

  test("base dealer still hits A+6", () => {
    const g = gameAtDealerTurn(undefined, [A, X]);
    expect(g.dealerDrawOne()).toBe(true);
  });

  test("s17 dealer still hits hard 16", () => {
    const g = gameAtDealerTurn("s17", [K, X]);
    expect(g.dealerDrawOne()).toBe(true);
  });
});

describe("six-deck shoe", () => {
  test("shoe holds 312 cards — six of each of the 52", () => {
    const g = new BlackjackGame("six-deck");
    const deck = (g as unknown as { deck: PlayingCard[] }).deck;
    expect(deck.length).toBe(312);
    expect(g.getState().shoeDepth).toBe(312);
    const counts = new Map<string, number>();
    for (const c of deck) {
      counts.set(cardKey(c), (counts.get(cardKey(c)) ?? 0) + 1);
    }
    expect(counts.size).toBe(52);
    for (const n of counts.values()) expect(n).toBe(6);
  });

  test("shoe persists across rounds and reshuffles under 15 cards", () => {
    const g = new BlackjackGame("six-deck");
    // All-nines shoe: every hand is 18 vs 18 → push, dealer never draws.
    injectDeck(
      g,
      Array.from({ length: 20 }, () => card(CardName.Nine)),
    );

    const playRound = () => {
      g.placeBet(5);
      g.stand();
      while (g.dealerDrawOne()) {}
      g.settleRound();
      g.newRound();
    };

    playRound(); // 20 ≥ 15 → no reshuffle, 4 cards dealt
    expect(g.getState().shoeDepth).toBe(16);
    playRound(); // 16 ≥ 15 → still the same shoe
    expect(g.getState().shoeDepth).toBe(12);

    g.placeBet(5); // 12 < 15 → fresh 312-card shoe, then 4 dealt
    expect(g.getState().shoeDepth).toBe(308);
    expect(getBankroll()).toBe(195); // two pushes returned their stakes
  });

  test("base single deck reshuffles every round", () => {
    setBankroll(100);
    const g = new BlackjackGame();
    injectDeck(
      g,
      Array.from({ length: 20 }, () => card(CardName.Nine)),
    );
    g.placeBet(5);
    expect(g.getState().shoeDepth).toBe(48); // fresh 52-card deck minus 4
  });
});

describe("late surrender", () => {
  function surrenderableGame(bet: number): BlackjackGame {
    const g = new BlackjackGame("surrender");
    g.placeBet(bet);
    const s = craft(g);
    s.phase = "PLAYER_TURN";
    s.playerHand = [N, E]; // 17
    s.dealerHand = [K, S]; // 17, no blackjack
    s.roundResult = null;
    return g;
  }

  test("surrender returns half the stake and ends the round", () => {
    setBankroll(100);
    const g = surrenderableGame(10);
    expect(g.canSurrender()).toBe(true);
    g.surrender();
    const s = g.getState();
    expect(s.phase).toBe("ROUND_OVER");
    expect(s.roundResult).toBe("surrender");
    expect(s.winner).toBe("computer");
    expect(getBankroll()).toBe(95); // 100 - 10 + 5
  });

  test("odd stakes floor the refund", () => {
    setBankroll(100);
    const g = surrenderableGame(5);
    g.surrender();
    expect(getBankroll()).toBe(97); // 100 - 5 + floor(2.5)
  });

  test("refused when the dealer has blackjack", () => {
    setBankroll(100);
    const g = surrenderableGame(10);
    craft(g).dealerHand = [A, K];
    expect(g.canSurrender()).toBe(false);
    g.surrender();
    expect(g.getState().phase).toBe("PLAYER_TURN");
    expect(getBankroll()).toBe(90); // stake still on the table
  });

  test("refused after hitting", () => {
    setBankroll(100);
    const g = surrenderableGame(10);
    g.hit();
    expect(g.getState().playerHand.length).toBeGreaterThan(2);
    expect(g.canSurrender()).toBe(false);
  });

  test("refused after splitting", () => {
    setBankroll(100);
    const g = surrenderableGame(10);
    const s = craft(g);
    s.playerHand = [card(CardName.Nine, Suit.Hearts), N];
    g.split();
    expect(g.getState().splitHand).not.toBeNull();
    expect(g.canSurrender()).toBe(false);
  });

  test("refused entirely under base rules", () => {
    setBankroll(100);
    const g = new BlackjackGame();
    g.placeBet(10);
    const s = craft(g);
    s.phase = "PLAYER_TURN";
    s.playerHand = [N, E];
    s.dealerHand = [K, S];
    expect(g.canSurrender()).toBe(false);
  });
});

describe("tight double", () => {
  function gameWithHand(
    presetId: string | undefined,
    hand: PlayingCard[],
  ): BlackjackGame {
    setBankroll(100);
    const g = new BlackjackGame(presetId);
    g.placeBet(10);
    const s = craft(g);
    s.phase = "PLAYER_TURN";
    s.playerHand = hand;
    s.roundResult = null;
    return g;
  }

  test("refuses 8 and 9, allows 10 and 11", () => {
    expect(gameWithHand("tight-double", [R, R]).canDoubleDown()).toBe(false); // 8
    expect(gameWithHand("tight-double", [F, R]).canDoubleDown()).toBe(false); // 9
    expect(gameWithHand("tight-double", [X, R]).canDoubleDown()).toBe(true); // 10
    expect(gameWithHand("tight-double", [X, F]).canDoubleDown()).toBe(true); // 11
  });

  test("base rules still allow 8 and 9", () => {
    expect(gameWithHand(undefined, [R, R]).canDoubleDown()).toBe(true);
    expect(gameWithHand(undefined, [F, R]).canDoubleDown()).toBe(true);
  });
});

describe("bankroll round trips", () => {
  function settleWith(
    g: BlackjackGame,
    player: PlayingCard[],
    dealer: PlayingCard[],
  ): void {
    const s = craft(g);
    s.phase = "DEALER_TURN";
    s.playerHand = player;
    s.dealerHand = dealer;
    s.roundResult = null;
    g.settleRound();
  }

  test("win pays even money", () => {
    setBankroll(100);
    const g = new BlackjackGame();
    g.placeBet(10);
    settleWith(g, [K, Q], [K, N]); // 20 beats 19
    expect(g.getState().roundResult).toBe("win");
    expect(getBankroll()).toBe(110);
    expect(g.getState().chips).toBe(110);
  });

  test("blackjack pays 3:2", () => {
    setBankroll(100);
    const g = new BlackjackGame();
    g.placeBet(10);
    settleWith(g, [A, K], [K, N]);
    expect(g.getState().roundResult).toBe("blackjack");
    expect(getBankroll()).toBe(115);
  });

  test("blackjack profit floors on an odd stake", () => {
    setBankroll(100);
    const g = new BlackjackGame();
    g.placeBet(5);
    settleWith(g, [A, K], [K, N]);
    expect(getBankroll()).toBe(107); // 95 + 5 + floor(7.5)
  });

  test("push returns the stake", () => {
    setBankroll(100);
    const g = new BlackjackGame();
    g.placeBet(10);
    settleWith(g, [K, Q], [K, J]); // 20 vs 20
    expect(g.getState().roundResult).toBe("push");
    expect(getBankroll()).toBe(100);
  });

  test("loss keeps the stake with the house", () => {
    setBankroll(100);
    const g = new BlackjackGame();
    g.placeBet(10);
    settleWith(g, [K, S], [K, N]); // 17 loses to 19
    expect(g.getState().roundResult).toBe("lose");
    expect(getBankroll()).toBe(90);
  });

  test("winning a doubled hand returns both wagers plus profit", () => {
    setBankroll(100);
    const g = new BlackjackGame();
    g.placeBet(10);
    const s = craft(g);
    s.phase = "PLAYER_TURN";
    s.playerHand = [X, F]; // 11
    s.roundResult = null;
    g.doubleDown();
    expect(getBankroll()).toBe(80);
    expect(g.getState().bet).toBe(20);
    settleWith(g, [K, X, F], [K, N]); // 21 beats 19
    expect(getBankroll()).toBe(120); // net +20
  });

  test("winning both split hands returns both wagers plus profit", () => {
    setBankroll(100);
    const g = new BlackjackGame();
    g.placeBet(10);
    const s = craft(g);
    s.phase = "PLAYER_TURN";
    s.playerHand = [card(CardName.Nine, Suit.Hearts), N];
    s.roundResult = null;
    g.split();
    expect(getBankroll()).toBe(80);
    s.phase = "PLAYER_TURN";
    s.activeHand = 0;
    s.playerHand = [K, Q]; // 20
    s.splitHand = [K, J]; // 20
    s.roundResult = null;
    s.splitResult = null;
    g.stand(); // hand 0 → hand 1
    g.stand(); // hand 1 → dealer turn
    craft(g).dealerHand = [K, N]; // 19
    g.settleRound();
    const done = g.getState();
    expect(done.roundResult).toBe("win");
    expect(done.splitResult).toBe("win");
    expect(getBankroll()).toBe(120); // both 10-chip stakes back, +10 each
  });

  test("surrender round-trips half the stake", () => {
    setBankroll(100);
    const g = new BlackjackGame("surrender");
    g.placeBet(10);
    const s = craft(g);
    s.phase = "PLAYER_TURN";
    s.playerHand = [N, E];
    s.dealerHand = [K, S];
    g.surrender();
    expect(getBankroll()).toBe(95);
    expect(g.getState().chips).toBe(95);
  });
});
