import { test, expect, describe } from "bun:test";
import { CardName, PlayingCard, Suit } from "typedeck";
import { resolvePreset } from "../../../shared/engine/variant";
import { cardKey } from "../../../shared/deck";
import { EUCHRE_FAMILY } from "../config";
import { EuchreGame } from "../game";
import { scoreCutthroatHand } from "../score";
import { bestPartnerGive } from "../bot";
import { cardStrength, effectiveSuit, isJoker, isTrump } from "../types";
import type { PlayerIndex } from "../types";

const ALL_SUITS = [Suit.Clubs, Suit.Diamonds, Suit.Spades, Suit.Hearts];

function c(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

describe("preset resolution", () => {
  test("base is partnership with target 10, stick-the-dealer, no joker", () => {
    expect(resolvePreset(EUCHRE_FAMILY)).toEqual({
      players: 4,
      targetScore: 10,
      stickTheDealer: true,
      joker: false,
    });
  });

  test("no-stick only disables stick-the-dealer", () => {
    expect(resolvePreset(EUCHRE_FAMILY, "no-stick")).toEqual({
      players: 4,
      targetScore: 10,
      stickTheDealer: false,
      joker: false,
    });
  });

  test("cutthroat plays three-handed", () => {
    expect(resolvePreset(EUCHRE_FAMILY, "cutthroat").players).toBe(3);
  });

  test("railroad adds the joker", () => {
    const cfg = resolvePreset(EUCHRE_FAMILY, "railroad");
    expect(cfg.joker).toBe(true);
    expect(cfg.players).toBe(4);
  });

  test("an unknown preset id falls back to base", () => {
    expect(resolvePreset(EUCHRE_FAMILY, "nope")).toEqual(EUCHRE_FAMILY.base);
  });
});

describe("no-stick (Gentleman's)", () => {
  test("the dealer may pass in round 2 and the hand is thrown in", () => {
    const game = new EuchreGame("no-stick");
    for (const p of [0, 1, 2, 3] as PlayerIndex[]) game.pass(p); // → BID2
    expect(game.getState().phase).toBe("BID2");
    for (const p of [0, 1, 2] as PlayerIndex[]) game.pass(p);

    expect(game.canPass(3)).toBe(true);
    expect(game.pass(3)).toBe(true);

    // Thrown in: redealt by the next dealer, back to round 1.
    const s = game.getState();
    expect(s.phase).toBe("BID1");
    expect(s.dealer).toBe(0); // advanced from 3
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.upCard).not.toBeNull();
    expect(s.turnedDownSuit).toBeNull();
  });

  test("base game still sticks the dealer", () => {
    const game = new EuchreGame();
    for (const p of [0, 1, 2, 3] as PlayerIndex[]) game.pass(p);
    for (const p of [0, 1, 2] as PlayerIndex[]) game.pass(p);
    expect(game.canPass(3)).toBe(false);
  });
});

describe("cutthroat (Three-Hand)", () => {
  test("deals 3×5 + up-card + 8-card kitty from 24 unique cards", () => {
    const game = new EuchreGame("cutthroat");
    const s = game.getState();
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 0]);
    expect(s.upCard).not.toBeNull();
    expect(s.kitty.length).toBe(8);

    const keys = new Set<string>();
    for (const h of s.hands) for (const card of h) keys.add(cardKey(card));
    keys.add(cardKey(s.upCard!));
    for (const card of s.kitty) keys.add(cardKey(card));
    expect(keys.size).toBe(24);
  });

  test("dealer rotation skips the absent seat 3", () => {
    const game = new EuchreGame("cutthroat");
    expect(game.getState().dealer).toBe(2); // You are eldest hand
    game.nextHand();
    expect(game.getState().dealer).toBe(0);
    game.nextHand();
    expect(game.getState().dealer).toBe(1);
    game.nextHand();
    expect(game.getState().dealer).toBe(2);
  });

  test("bidding rotates over 3 seats and going alone is implicit", () => {
    const game = new EuchreGame("cutthroat");
    expect(game.getState().bidTurn).toBe(0);
    game.pass(0);
    expect(game.getState().bidTurn).toBe(1);
    game.pass(1);
    expect(game.getState().bidTurn).toBe(2); // dealer, never 3
    game.pass(2);
    expect(game.getState().phase).toBe("BID2");

    const s0 = game.getState();
    const named = ALL_SUITS.find((x) => x !== s0.turnedDownSuit)!;
    expect(game.nameTrump(0, named, true)).toBe(true);
    const s = game.getState();
    expect(s.alone).toBe(false); // no partner to sit out
    expect(s.aloneSitter).toBeNull();
  });

  test("tricks have three cards and seat 3 never plays", () => {
    const game = new EuchreGame("cutthroat");
    expect(game.orderUp(0, false)).toBe(true);
    const played = new Set<number>();
    let guard = 0;
    while (game.getState().phase === "PLAYING" && guard++ < 40) {
      const p = game.getState().currentTurn;
      played.add(p);
      game.playCard(p, game.legalPlaysFor(p)[0]!);
    }
    expect(played.has(3)).toBe(false);
    const s = game.getState();
    expect(s.completedTricks.length).toBe(5);
    for (const t of s.completedTricks) expect(t.plays.length).toBe(3);
    expect(s.trickWins.length).toBe(3);
    expect(s.trickWins.reduce((a, b) => a + b, 0)).toBe(5);
  });

  test("maker scoring: 3–4 tricks = 1, march = 3", () => {
    expect(scoreCutthroatHand([3, 1, 1], 0)).toMatchObject({
      maker: 0,
      awards: [{ side: 0, points: 1 }],
      kind: "made",
    });
    expect(scoreCutthroatHand([1, 4, 0], 1)).toMatchObject({
      awards: [{ side: 1, points: 1 }],
      kind: "made",
    });
    expect(scoreCutthroatHand([5, 0, 0], 0)).toMatchObject({
      awards: [{ side: 0, points: 3 }],
      kind: "march",
    });
  });

  test("euchred maker → EACH defender scores 2", () => {
    expect(scoreCutthroatHand([1, 2, 2], 0)).toMatchObject({
      kind: "euchre",
      awards: [
        { side: 1, points: 2 },
        { side: 2, points: 2 },
      ],
    });
    expect(scoreCutthroatHand([2, 1, 2], 1)).toMatchObject({
      kind: "euchre",
      awards: [
        { side: 0, points: 2 },
        { side: 2, points: 2 },
      ],
    });
  });

  test("plays through to an individual winner at 10", () => {
    const game = new EuchreGame("cutthroat");
    let guard = 0;
    while (guard++ < 4000) {
      const s = game.getState();
      if (s.phase === "GAME_OVER") break;
      if (s.phase === "HAND_OVER") game.nextHand();
      else if (s.phase === "BID1" || s.phase === "BID2") game.botBid();
      else if (s.phase === "DISCARD")
        game.discard(s.dealer, s.hands[s.dealer]![0]!);
      else {
        const p = s.currentTurn;
        game.playCard(p, game.legalPlaysFor(p)[0]!);
      }
    }
    const s = game.getState();
    expect(s.phase).toBe("GAME_OVER");
    expect([0, 1, 2]).toContain(s.winner!);
    expect(Math.max(...s.scores)).toBeGreaterThanOrEqual(10);
  });
});

describe("railroad (joker)", () => {
  const joker = c(CardName.Joker, Suit.Spades);

  test("the joker is the highest trump, above the right bower", () => {
    for (const trump of ALL_SUITS) {
      expect(effectiveSuit(joker, trump)).toBe(trump);
      expect(isTrump(joker, trump)).toBe(true);
      const right = c(CardName.Jack, trump);
      const led = trump === Suit.Hearts ? Suit.Clubs : Suit.Hearts;
      expect(cardStrength(joker, trump, led)).toBeGreaterThan(
        cardStrength(right, trump, led),
      );
    }
  });

  test("deals from a 25-card deck with a 4-card kitty; joker never turned up", () => {
    const game = new EuchreGame("railroad");
    const s = game.getState();
    expect(s.hands.map((h) => h.length)).toEqual([5, 5, 5, 5]);
    expect(s.kitty.length).toBe(4);
    expect(isJoker(s.upCard!)).toBe(false);

    const keys = new Set<string>();
    let jokers = 0;
    const all = [...s.hands.flat(), s.upCard!, ...s.kitty];
    for (const card of all) {
      keys.add(cardKey(card));
      if (isJoker(card)) jokers++;
    }
    expect(keys.size).toBe(25);
    expect(jokers).toBe(1);
  });

  test("bestPartnerGive prefers the highest trump, else the highest card", () => {
    const trump = Suit.Spades;
    const withTrump = [
      c(CardName.Ace, Suit.Hearts),
      c(CardName.Nine, Suit.Spades),
      c(CardName.Jack, Suit.Clubs), // left bower — highest trump here
    ];
    expect(cardKey(bestPartnerGive(withTrump, trump))).toBe(
      cardKey(c(CardName.Jack, Suit.Clubs)),
    );

    const noTrump = [
      c(CardName.King, Suit.Hearts),
      c(CardName.Ace, Suit.Diamonds),
      c(CardName.Ten, Suit.Clubs),
    ];
    expect(cardKey(bestPartnerGive(noTrump, trump))).toBe(
      cardKey(c(CardName.Ace, Suit.Diamonds)),
    );
  });

  test("going alone transfers the partner's best card to the loner", () => {
    const game = new EuchreGame("railroad");
    for (const p of [0, 1, 2, 3] as PlayerIndex[]) game.pass(p); // → BID2
    const before = game.getState();
    const partnerBefore = [...before.hands[2]!];
    const named = ALL_SUITS.find((x) => x !== before.turnedDownSuit)!;
    const expectedGift = bestPartnerGive(partnerBefore, named);

    expect(game.nameTrump(0, named, true)).toBe(true);

    // Human loner: picker phase with the sixth card in hand.
    const s = game.getState();
    expect(s.phase).toBe("ALONE_DISCARD");
    expect(s.hands[0]!.length).toBe(6);
    expect(s.hands[2]!.length).toBe(4);
    const myKeys = new Set(s.hands[0]!.map(cardKey));
    expect(myKeys.has(cardKey(expectedGift))).toBe(true);
    expect(s.hands[2]!.some((x) => cardKey(x) === cardKey(expectedGift))).toBe(
      false,
    );

    // Discard back to five and play begins with the partner sitting out.
    expect(game.aloneDiscard(s.hands[0]![0]!)).toBe(true);
    const s2 = game.getState();
    expect(s2.phase).toBe("PLAYING");
    expect(s2.hands[0]!.length).toBe(5);
    expect(s2.aloneSitter).toBe(2);
  });

  test("a bot loner completes the exchange and discard automatically", () => {
    const game = new EuchreGame("railroad");
    for (const p of [0, 1, 2, 3] as PlayerIndex[]) game.pass(p); // → BID2
    game.pass(0);
    const named = ALL_SUITS.find((x) => x !== game.getState().turnedDownSuit)!;
    expect(game.nameTrump(1, named, true)).toBe(true);

    const s = game.getState();
    expect(s.phase).toBe("PLAYING");
    expect(s.aloneSitter).toBe(3);
    expect(s.hands[1]!.length).toBe(5); // gift taken, then discarded down
    expect(s.hands[3]!.length).toBe(4); // sitter gave one up
  });
});
