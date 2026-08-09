import { test, expect, describe } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import { RummyGame } from "../game";
import type { RummyState } from "../types";
import { createDeck } from "../../../shared/deck";
import { classifyMeld } from "../rules";

const DECK = createDeck();
const card = (name: CardName, suit: Suit): PlayingCard =>
  DECK.find((c) => c.cardName === name && c.suit === suit)!;

function mut(game: RummyGame): RummyState {
  return game.getState() as RummyState;
}

describe("boathouse rum", () => {
  test("preset config: double draw, round-the-corner runs, rummy-only go-out", () => {
    const cfg = new RummyGame("boathouse", 1).getConfig();
    expect(cfg.meldsOnTable).toBe(false);
    expect(cfg.layOffAllowed).toBe(false);
    expect(cfg.boathouseDoubleDraw).toBe(true);
    expect(cfg.mustGoRummy).toBe(true);
    expect(cfg.runOptions).toEqual({ aceHigh: false, roundTheCorner: true });
    expect(cfg.scoring).toBe("shed");
  });

  test("taking the discard forces a second draw from stock (2 in, 1 out)", () => {
    const game = new RummyGame("boathouse", 1);
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    s.playerHand = [card(CardName.Nine, Suit.Clubs)];
    s.discardPile = [
      card(CardName.Five, Suit.Clubs),
      card(CardName.Nine, Suit.Diamonds),
    ];
    s.stock = [card(CardName.Two, Suit.Hearts)];

    expect(game.playerDrawFromDiscard()).toBe(true);
    expect(s.playerHand.length).toBe(3); // 9♦ from discard + 2♥ from stock
    expect(s.stock.length).toBe(0);
    expect(s.discardPile.length).toBe(1);
    expect(s.phase).toBe("PLAYER_MELD");
  });

  test("drawing from stock takes a single card as usual", () => {
    const game = new RummyGame("boathouse", 2);
    const s = mut(game);
    s.phase = "PLAYER_TURN";
    s.currentTurn = "player";
    const before = s.playerHand.length;
    expect(game.playerDrawFromStock()).toBe(true);
    expect(s.playerHand.length).toBe(before + 1);
  });

  test("round-the-corner run K-A-2 is a valid meld here", () => {
    const wrap = [
      card(CardName.King, Suit.Spades),
      card(CardName.Ace, Suit.Spades),
      card(CardName.Two, Suit.Spades),
    ];
    expect(
      classifyMeld(wrap, { aceHigh: false, roundTheCorner: true }),
    ).not.toBeNull();
    expect(
      classifyMeld(wrap, { aceHigh: false, roundTheCorner: false }),
    ).toBeNull();
  });

  test("partial melding to the table is not allowed", () => {
    const game = new RummyGame("boathouse", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.Seven, Suit.Spades),
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Seven, Suit.Diamonds),
      card(CardName.Nine, Suit.Clubs),
    ];
    expect(game.playerMeld([0, 1, 2])).toBe(false);
    expect(s.tableMelds.length).toBe(0);
  });

  test("go rummy: the whole hand must meld at once, including a wrap run", () => {
    const game = new RummyGame("boathouse", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.King, Suit.Spades),
      card(CardName.Ace, Suit.Spades),
      card(CardName.Two, Suit.Spades),
      card(CardName.Three, Suit.Hearts),
      card(CardName.Three, Suit.Diamonds),
      card(CardName.Three, Suit.Clubs),
      card(CardName.Seven, Suit.Diamonds),
      card(CardName.Eight, Suit.Diamonds),
      card(CardName.Nine, Suit.Diamonds),
      card(CardName.Queen, Suit.Hearts), // the discard
    ];
    s.computerHand = [
      card(CardName.King, Suit.Diamonds),
      card(CardName.Five, Suit.Clubs),
    ]; // 10 + 5 = 15 to the winner

    expect(game.canPlayerGoRummy()).toBe(true);
    const qIdx = 9;
    expect(game.playerGoRummy(qIdx)).toBe(true);
    expect(s.phase).toBe("ROUND_OVER");
    expect(s.roundWinner).toBe("player");
    expect(s.roundPoints).toBe(15);
    expect(s.playerHand.length).toBe(0);
    expect(s.tableMelds.length).toBe(3);
    expect(s.discardPile[s.discardPile.length - 1]!.cardName).toBe(
      CardName.Queen,
    );
  });

  test("go rummy is refused while the hand does not fully meld", () => {
    const game = new RummyGame("boathouse", 1);
    const s = mut(game);
    s.phase = "PLAYER_MELD";
    s.currentTurn = "player";
    s.playerHand = [
      card(CardName.Seven, Suit.Spades),
      card(CardName.Seven, Suit.Hearts),
      card(CardName.Nine, Suit.Clubs),
      card(CardName.Two, Suit.Diamonds),
    ];
    expect(game.canPlayerGoRummy()).toBe(false);
    expect(game.playerGoRummy(3)).toBe(false);
    expect(game.playerGoRummy(null)).toBe(false);
    expect(s.phase).toBe("PLAYER_MELD");
    // The only way forward is an ordinary discard.
    expect(game.playerDiscard(2)).toBe(true);
    expect(s.phase).toBe("BOT_TURN");
  });
});
