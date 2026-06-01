import { test, expect, describe } from "bun:test";
import { PlayingCard, CardName, Suit } from "typedeck";
import { CuttleGame } from "../game";
import { chooseBotAction, chooseCounter, chooseDiscards } from "../ai";
import {
  type CuttleState,
  type FieldCard,
  emptyField,
  cardKey,
} from "../types";

const C = (name: CardName, suit: Suit) => new PlayingCard(name, suit);
const fc = (
  card: PlayingCard,
  owner: "player" | "computer" = "computer",
): FieldCard => ({
  card,
  owner,
  jacks: [],
});

function state(patch: Partial<CuttleState>): CuttleState {
  const s = new CuttleGame("computer").getState() as CuttleState;
  Object.assign(s, {
    phase: "BOT_TURN",
    turn: "computer",
    deck: [],
    scrap: [],
    hands: { player: [], computer: [] },
    fields: { player: emptyField(), computer: emptyField() },
    oneOff: null,
    counterDecider: null,
    sevenCards: null,
    frozenKey: null,
    frozenOwner: null,
    discardCount: 0,
    passes: 0,
    winner: null,
    ...patch,
  });
  return s;
}

describe("chooseBotAction", () => {
  test("takes a lethal points play", () => {
    const s = state({
      hands: { player: [], computer: [C(CardName.Ten, Suit.Hearts)] },
      fields: {
        player: emptyField(),
        computer: {
          ...emptyField(),
          points: [
            fc(C(CardName.Six, Suit.Clubs)),
            fc(C(CardName.Five, Suit.Clubs)),
          ],
        },
      },
    });
    // 11 + 10 = 21 → win
    const action = chooseBotAction(s);
    expect(action).toEqual({
      type: "points",
      key: cardKey(C(CardName.Ten, Suit.Hearts)),
    });
  });

  test("draws when no play clears the usefulness bar", () => {
    const s = state({
      hands: { player: [], computer: [C(CardName.Ace, Suit.Clubs)] }, // Ace one-off bad when ahead
      deck: [C(CardName.King, Suit.Spades)],
      fields: {
        player: emptyField(),
        computer: {
          ...emptyField(),
          points: [fc(C(CardName.Ten, Suit.Hearts))],
        },
      },
    });
    expect(chooseBotAction(s)).toEqual({ type: "draw" });
  });
});

describe("chooseCounter", () => {
  test("counters a harmful Ace when it would otherwise resolve", () => {
    const s = state({
      hands: { player: [], computer: [C(CardName.Two, Suit.Clubs)] },
      fields: {
        player: emptyField(),
        computer: {
          ...emptyField(),
          points: [
            fc(C(CardName.Ten, Suit.Hearts)),
            fc(C(CardName.Ten, Suit.Diamonds)),
          ],
        },
      },
      oneOff: {
        stack: [C(CardName.Ace, Suit.Spades)],
        by: "player",
        targetKey: null,
      },
    });
    // Bot is ahead 20-0; the Ace resolving wipes its points → counter.
    expect(chooseCounter(s, "computer")).toBe(0);
  });

  test("does not counter when it has no Two", () => {
    const s = state({
      hands: { player: [], computer: [C(CardName.King, Suit.Clubs)] },
      oneOff: {
        stack: [C(CardName.Ace, Suit.Spades)],
        by: "player",
        targetKey: null,
      },
    });
    expect(chooseCounter(s, "computer")).toBe(null);
  });
});

describe("chooseDiscards", () => {
  test("discards the weakest cards first", () => {
    const hand = [
      C(CardName.King, Suit.Spades), // worth 14
      C(CardName.Three, Suit.Clubs), // worth 3
      C(CardName.Two, Suit.Hearts), // worth 11
    ];
    expect(chooseDiscards(hand, 1)).toEqual([1]); // the Three
  });
});
