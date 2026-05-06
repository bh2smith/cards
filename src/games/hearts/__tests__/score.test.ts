import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { gameWinner, scoreRound } from "../score";
import type { PlayerIndex, Trick } from "../types";

function c(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

function trick(
  leader: PlayerIndex,
  ledSuit: Suit,
  cardsByPlayer: { player: PlayerIndex; card: PlayingCard }[],
): Trick {
  return { leader, ledSuit, plays: cardsByPlayer };
}

const HA = c(CardName.Ace, Suit.Hearts);
const H2 = c(CardName.Two, Suit.Hearts);
const H3 = c(CardName.Three, Suit.Hearts);
const H4 = c(CardName.Four, Suit.Hearts);
const H5 = c(CardName.Five, Suit.Hearts);
const H6 = c(CardName.Six, Suit.Hearts);
const H7 = c(CardName.Seven, Suit.Hearts);
const H8 = c(CardName.Eight, Suit.Hearts);
const H9 = c(CardName.Nine, Suit.Hearts);
const H10 = c(CardName.Ten, Suit.Hearts);
const HJ = c(CardName.Jack, Suit.Hearts);
const HQ = c(CardName.Queen, Suit.Hearts);
const HK = c(CardName.King, Suit.Hearts);
const SQ = c(CardName.Queen, Suit.Spades);
const D2 = c(CardName.Two, Suit.Diamonds);
const D3 = c(CardName.Three, Suit.Diamonds);
const D4 = c(CardName.Four, Suit.Diamonds);
const D5 = c(CardName.Five, Suit.Diamonds);

describe("scoreRound", () => {
  test("standard scoring: hearts to taker, Q♠ to taker", () => {
    const tricks: Trick[] = [
      trick(0, Suit.Hearts, [
        { player: 0, card: H4 },
        { player: 1, card: HA },
        { player: 2, card: H2 },
        { player: 3, card: H3 },
      ]),
      trick(1, Suit.Spades, [
        { player: 1, card: SQ },
        { player: 2, card: c(CardName.Two, Suit.Spades) },
        { player: 3, card: c(CardName.Three, Suit.Spades) },
        { player: 0, card: c(CardName.Four, Suit.Spades) },
      ]),
    ];
    const result = scoreRound(tricks);
    expect(result.pointsByPlayer[1]).toBe(4 + 13);
    expect(result.pointsByPlayer[0]).toBe(0);
    expect(result.shotTheMoon).toBeNull();
  });

  test("shoot the moon: shooter gets 0, others get 26", () => {
    const moonHearts = [HA, HK, HQ, HJ, H10, H9, H8, H7, H6, H5, H4, H3, H2];
    const moonTricks: Trick[] = moonHearts.map((heart, i) =>
      trick(2, Suit.Hearts, [
        { player: 0, card: c(CardName.Two, Suit.Diamonds) },
        { player: 1, card: c(CardName.Three, Suit.Diamonds) },
        { player: 2, card: heart },
        { player: 3, card: c(CardName.Four, Suit.Diamonds) },
      ]),
    );
    moonTricks.push(
      trick(2, Suit.Spades, [
        { player: 0, card: c(CardName.Two, Suit.Diamonds) },
        { player: 1, card: c(CardName.Three, Suit.Diamonds) },
        { player: 2, card: SQ },
        { player: 3, card: c(CardName.Four, Suit.Diamonds) },
      ]),
    );
    const result = scoreRound(moonTricks);
    expect(result.shotTheMoon).toBe(2 as PlayerIndex);
    expect(result.pointsByPlayer).toEqual([26, 26, 0, 26]);
  });

  test("no shoot if any heart goes elsewhere", () => {
    const tricks: Trick[] = [
      trick(0, Suit.Hearts, [
        { player: 0, card: H4 },
        { player: 1, card: HA },
        { player: 2, card: H2 },
        { player: 3, card: H3 },
      ]),
    ];
    const result = scoreRound(tricks);
    expect(result.shotTheMoon).toBeNull();
  });
});

describe("gameWinner", () => {
  test("returns null until threshold reached", () => {
    expect(gameWinner([10, 20, 30, 40], 100)).toBeNull();
  });

  test("returns lowest score when any player crosses threshold", () => {
    expect(gameWinner([102, 50, 80, 70])).toBeUndefined;
    expect(gameWinner([102, 50, 80, 70], 100)).toBe(1 as PlayerIndex);
  });
});
