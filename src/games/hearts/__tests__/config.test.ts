import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { resolvePreset } from "../../../shared/engine/variant";
import { HEARTS_FAMILY } from "../config";
import { HeartsGame } from "../game";
import { scoreRound } from "../score";
import { type PlayerIndex, type Trick, cardPoints } from "../types";

function c(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

const HEART_RANKS: CardName[] = [
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
  CardName.Ace,
];

const SQ = c(CardName.Queen, Suit.Spades);
const SK = c(CardName.King, Suit.Spades);
const SA = c(CardName.Ace, Suit.Spades);
const DJ = c(CardName.Jack, Suit.Diamonds);

/** 13 heart tricks all won by `taker` (others discard clubs off-suit). */
function heartSweep(taker: PlayerIndex): Trick[] {
  return HEART_RANKS.map((rank) => {
    const plays = [{ player: taker, card: c(rank, Suit.Hearts) }];
    const filler = [
      c(CardName.Two, Suit.Clubs),
      c(CardName.Three, Suit.Clubs),
      c(CardName.Four, Suit.Clubs),
    ];
    let f = 0;
    for (let p = 0 as PlayerIndex; p < 4; p = (p + 1) as PlayerIndex) {
      if (p !== taker) plays.push({ player: p, card: filler[f++]! });
    }
    return { leader: taker, ledSuit: Suit.Hearts, plays };
  });
}

/** A trick `winner` takes by leading its highest card in `ledSuit`. */
function wonTrick(
  winner: PlayerIndex,
  ledSuit: Suit,
  winnerCard: PlayingCard,
  others: PlayingCard[],
): Trick {
  const plays = [{ player: winner, card: winnerCard }];
  let o = 0;
  for (let p = 0 as PlayerIndex; p < 4; p = (p + 1) as PlayerIndex) {
    if (p !== winner) plays.push({ player: p, card: others[o++]! });
  }
  return { leader: winner, ledSuit, plays };
}

describe("preset resolution", () => {
  test("undefined preset id resolves to Black Lady base", () => {
    const cfg = resolvePreset(HEARTS_FAMILY);
    expect(cfg.spadePenalties).toEqual({ queen: 13, king: 0, ace: 0 });
    expect(cfg.jackDiamondsBonus).toBe(0);
    expect(cfg.passing).toBe(true);
    expect(cfg.fixedPassDirection).toBeNull();
    expect(cfg.targetScore).toBe(100);
    expect(cfg.heartValue(c(CardName.Ace, Suit.Hearts))).toBe(1);
  });

  test("unknown preset id falls back to base", () => {
    expect(resolvePreset(HEARTS_FAMILY, "nope")).toEqual(
      resolvePreset(HEARTS_FAMILY),
    );
  });

  test("each preset resolves with its overrides on top of base", () => {
    expect(resolvePreset(HEARTS_FAMILY, "spot").targetScore).toBe(500);
    expect(resolvePreset(HEARTS_FAMILY, "black-maria").fixedPassDirection).toBe(
      "right",
    );
    expect(resolvePreset(HEARTS_FAMILY, "omnibus").jackDiamondsBonus).toBe(-10);
    expect(resolvePreset(HEARTS_FAMILY, "no-pass").passing).toBe(false);
    // untouched fields inherit base
    expect(resolvePreset(HEARTS_FAMILY, "omnibus").targetScore).toBe(100);
  });
});

describe("spot", () => {
  const cfg = resolvePreset(HEARTS_FAMILY, "spot");

  test("hearts count pips summing 104; no Q♠ penalty", () => {
    const total = HEART_RANKS.reduce(
      (s, rank) => s + cardPoints(c(rank, Suit.Hearts), cfg),
      0,
    );
    expect(total).toBe(104);
    expect(cardPoints(c(CardName.Two, Suit.Hearts), cfg)).toBe(2);
    expect(cardPoints(c(CardName.Jack, Suit.Hearts), cfg)).toBe(11);
    expect(cardPoints(c(CardName.Ace, Suit.Hearts), cfg)).toBe(14);
    expect(cardPoints(SQ, cfg)).toBe(0);
  });

  test("moon = all hearts (no Q♠ needed); others gain the full 104", () => {
    const result = scoreRound(heartSweep(2), cfg);
    expect(result.shotTheMoon).toBe(2 as PlayerIndex);
    expect(result.pointsByPlayer).toEqual([104, 104, 0, 104]);
  });
});

describe("black-maria", () => {
  const cfg = resolvePreset(HEARTS_FAMILY, "black-maria");

  test("K♠ and A♠ carry penalties alongside Q♠", () => {
    expect(cardPoints(SQ, cfg)).toBe(13);
    expect(cardPoints(SK, cfg)).toBe(10);
    expect(cardPoints(SA, cfg)).toBe(7);
    const result = scoreRound(
      [wonTrick(0, Suit.Spades, SA, [SK, SQ, c(CardName.Two, Suit.Spades)])],
      cfg,
    );
    expect(result.pointsByPlayer[0]).toBe(7 + 10 + 13);
  });

  test("passes 3 to the right every round, no rotation", () => {
    const game = new HeartsGame("black-maria");
    expect(game.getState().phase).toBe("PASSING");
    expect(game.getState().passDirection).toBe("right");
  });

  test("moon without capturing K♠/A♠ still moons", () => {
    const tricks = heartSweep(2);
    // shooter takes the Q♠…
    tricks.push(
      wonTrick(2, Suit.Spades, SQ, [
        c(CardName.Two, Suit.Spades),
        c(CardName.Three, Suit.Spades),
        c(CardName.Four, Suit.Spades),
      ]),
    );
    // …while K♠/A♠ go to player 0
    tricks.push(
      wonTrick(0, Suit.Spades, SA, [
        SK,
        c(CardName.Five, Suit.Spades),
        c(CardName.Six, Suit.Spades),
      ]),
    );
    const result = scoreRound(tricks, cfg);
    expect(result.shotTheMoon).toBe(2 as PlayerIndex);
    expect(result.pointsByPlayer).toEqual([26, 26, 0, 26]);
  });
});

describe("omnibus", () => {
  const cfg = resolvePreset(HEARTS_FAMILY, "omnibus");

  test("J♦ is −10 to its captor", () => {
    const result = scoreRound(
      [
        wonTrick(0, Suit.Diamonds, c(CardName.Ace, Suit.Diamonds), [
          DJ,
          c(CardName.Two, Suit.Diamonds),
          c(CardName.Two, Suit.Hearts),
        ]),
      ],
      cfg,
    );
    expect(result.pointsByPlayer[0]).toBe(1 - 10);
  });

  test("J♦ never blocks a moon and the shooter keeps its −10", () => {
    const tricks = heartSweep(2);
    tricks.push(
      wonTrick(2, Suit.Spades, SQ, [
        c(CardName.Two, Suit.Spades),
        c(CardName.Three, Suit.Spades),
        c(CardName.Four, Suit.Spades),
      ]),
    );
    tricks.push(
      wonTrick(2, Suit.Diamonds, c(CardName.Ace, Suit.Diamonds), [
        DJ,
        c(CardName.Two, Suit.Diamonds),
        c(CardName.Three, Suit.Diamonds),
      ]),
    );
    const result = scoreRound(tricks, cfg);
    expect(result.shotTheMoon).toBe(2 as PlayerIndex);
    expect(result.pointsByPlayer).toEqual([26, 26, -10, 26]);
  });

  test("a non-shooter's J♦ bonus survives someone else's moon", () => {
    const tricks = heartSweep(2);
    tricks.push(
      wonTrick(2, Suit.Spades, SQ, [
        c(CardName.Two, Suit.Spades),
        c(CardName.Three, Suit.Spades),
        c(CardName.Four, Suit.Spades),
      ]),
    );
    tricks.push(
      wonTrick(0, Suit.Diamonds, c(CardName.Ace, Suit.Diamonds), [
        DJ,
        c(CardName.Two, Suit.Diamonds),
        c(CardName.Three, Suit.Diamonds),
      ]),
    );
    const result = scoreRound(tricks, cfg);
    expect(result.shotTheMoon).toBe(2 as PlayerIndex);
    expect(result.pointsByPlayer).toEqual([16, 26, 0, 26]);
  });
});

describe("no-pass", () => {
  test("deals straight into PLAYING with no passing phase", () => {
    const game = new HeartsGame("no-pass");
    expect(game.getState().phase).toBe("PLAYING");
    expect(game.getState().passDirection).toBe("hold");
    expect(game.getState().currentTrick).not.toBeNull();
  });

  test("every subsequent round also skips passing", () => {
    const game = new HeartsGame("no-pass");
    let safety = 200;
    while (game.getState().phase === "PLAYING" && safety-- > 0) {
      if (game.getState().currentTurn === 0) {
        game.playCard(0, game.legalPlaysFor(0)[0]!);
      } else {
        game.botPlay();
      }
    }
    expect(safety).toBeGreaterThan(0);
    if (game.getState().phase === "ROUND_OVER") {
      game.nextRound();
      expect(game.getState().phase).toBe("PLAYING");
    }
  });
});
