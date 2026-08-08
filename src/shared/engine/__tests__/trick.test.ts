import { test, expect } from "bun:test";
import { CardName, PlayingCard, Suit } from "typedeck";
import { legalPlays, trickWinner, type TrickRules } from "../trick";

function card(name: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(name, suit);
}

const plainRules: TrickRules = {
  effectiveSuit: (c) => c.suit,
  strength: (c, led) => (c.suit === led ? c.cardName : -1),
};

test("leading allows the whole hand", () => {
  const hand = [
    card(CardName.Two, Suit.Clubs),
    card(CardName.Ace, Suit.Hearts),
  ];
  expect(legalPlays(hand, null, plainRules)).toHaveLength(2);
});

test("must follow the led suit when able", () => {
  const hand = [
    card(CardName.Two, Suit.Clubs),
    card(CardName.Ace, Suit.Hearts),
  ];
  const led = card(CardName.Nine, Suit.Clubs);
  const legals = legalPlays(hand, led, plainRules);
  expect(legals).toHaveLength(1);
  expect(legals[0]!.suit).toBe(Suit.Clubs);
});

test("void in led suit frees the whole hand", () => {
  const hand = [
    card(CardName.Two, Suit.Spades),
    card(CardName.Ace, Suit.Hearts),
  ];
  const led = card(CardName.Nine, Suit.Clubs);
  expect(legalPlays(hand, led, plainRules)).toHaveLength(2);
});

test("mayPlay restricts candidates after the follow filter", () => {
  const noAces: TrickRules = {
    ...plainRules,
    mayPlay: (c) => c.cardName !== CardName.Ace,
  };
  const hand = [card(CardName.Ace, Suit.Clubs), card(CardName.Two, Suit.Clubs)];
  const led = card(CardName.Nine, Suit.Clubs);
  const legals = legalPlays(hand, led, noAces);
  expect(legals).toHaveLength(1);
  expect(legals[0]!.cardName).toBe(CardName.Two);
});

test("highest card of the led suit wins; off-suit cannot win", () => {
  const winner = trickWinner(
    [
      { player: 0, card: card(CardName.Ten, Suit.Clubs) },
      { player: 1, card: card(CardName.Ace, Suit.Hearts) },
      { player: 2, card: card(CardName.King, Suit.Clubs) },
    ],
    plainRules,
  );
  expect(winner).toBe(2);
});

test("trump strength overrides the led suit when rules say so", () => {
  const trumpHearts: TrickRules = {
    effectiveSuit: (c) => c.suit,
    strength: (c, led) =>
      c.suit === Suit.Hearts
        ? 100 + c.cardName
        : c.suit === led
          ? c.cardName
          : -1,
  };
  const winner = trickWinner(
    [
      { player: 0, card: card(CardName.Ace, Suit.Clubs) },
      { player: 1, card: card(CardName.Two, Suit.Hearts) },
    ],
    trumpHearts,
  );
  expect(winner).toBe(1);
});

test("empty trick throws", () => {
  expect(() => trickWinner([], plainRules)).toThrow();
});
