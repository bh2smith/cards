import { test, expect, describe } from "bun:test";
import { CardName, Suit, PlayingCard } from "typedeck";
import { OldMaidGame } from "../game";
import { cardKey } from "../../../shared/deck";

const ALL_RANKS = [
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

function card(rank: CardName, suit: Suit): PlayingCard {
  return new PlayingCard(rank, suit);
}

function suited(ranks: CardName[], suits: Suit[]): PlayingCard[] {
  return ranks.flatMap((r) => suits.map((s) => card(r, s)));
}

/** Alternate deal starting with the player: player gets 26, bot gets 25. */
function interleave(
  playerCards: PlayingCard[],
  botCards: PlayingCard[],
): PlayingCard[] {
  expect(playerCards.length).toBe(26);
  expect(botCards.length).toBe(25);
  const deck: PlayingCard[] = [];
  for (let i = 0; i < playerCards.length; i++) {
    deck.push(playerCards[i]!);
    if (i < botCards.length) deck.push(botCards[i]!);
  }
  return deck;
}

function botHand(game: OldMaidGame): PlayingCard[] {
  return game.cardsInPlay().slice(game.getState().playerHand.length);
}

function assertConserved(game: OldMaidGame): void {
  const s = game.getState();
  expect(game.cardsInPlay().length + 2 * (s.playerPairs + s.botPairs)).toBe(51);
}

function assertNoRankDuplicates(hand: PlayingCard[]): void {
  const ranks = hand.map((c) => c.cardName);
  expect(new Set(ranks).size).toBe(ranks.length);
}

describe("initial deal and auto-pairing", () => {
  test("seeded deal lays all pairs, conserves 51 cards, keeps exactly one queen", () => {
    const game = new OldMaidGame(42);
    const state = game.getState();

    assertConserved(game);
    assertNoRankDuplicates(state.playerHand);
    assertNoRankDuplicates(botHand(game));

    const inPlay = game.cardsInPlay();
    expect(new Set(inPlay.map(cardKey)).size).toBe(inPlay.length);
    expect(
      inPlay.some(
        (c) => cardKey(c) === cardKey(card(CardName.Queen, Suit.Clubs)),
      ),
    ).toBe(false);
    expect(inPlay.filter((c) => c.cardName === CardName.Queen).length).toBe(1);

    expect(state.botHandCount).toBe(botHand(game).length);
    expect(state.botDrawableIndices).toEqual(botHand(game).map((_, i) => i));
    expect(state.phase).toBe("PLAYER_DRAW");
  });

  test("same seed replays the same deal", () => {
    const a = new OldMaidGame(7);
    const b = new OldMaidGame(7);
    expect(a.getState().playerHand.map(cardKey)).toEqual(
      b.getState().playerHand.map(cardKey),
    );
    expect(botHand(a).map(cardKey)).toEqual(botHand(b).map(cardKey));
  });

  test("three of a kind lays exactly one pair and keeps one card", () => {
    // Player is dealt all three queens: the trio must lay one pair, keep one.
    const game = new OldMaidGame(1, playerLosesDeck());
    const state = game.getState();

    const queens = state.playerHand.filter(
      (c) => c.cardName === CardName.Queen,
    );
    expect(queens.length).toBe(1);
    expect(state.playerHand.length).toBe(2); // one queen + the lone 7♥
    expect(state.playerPairs).toBe(12);
    expect(state.botPairs).toBe(12); // bot's 7-trio also laid one pair
    expect(botHand(game).length).toBe(1);
    assertConserved(game);
  });
});

describe("drawing", () => {
  test("a draw transfers one card and auto-pairs, alternating turns", () => {
    const game = new OldMaidGame(42);
    const before = game.getState();
    const playerBefore = before.playerHand.length;
    const botBefore = before.botHandCount;
    const pairsBefore = before.playerPairs;

    expect(game.playerDraw(0)).toBe(true);
    const after = game.getState();

    expect(after.botHandCount).toBe(botBefore - 1);
    const laid = after.playerPairs - pairsBefore;
    expect([0, 1]).toContain(laid);
    expect(after.playerHand.length).toBe(playerBefore + 1 - 2 * laid);
    assertConserved(game);

    expect(after.phase).toBe("BOT_DRAW");
    expect(game.playerDraw(0)).toBe(false); // not the player's turn

    const playerCount = after.playerHand.length;
    expect(game.botDraw()).toBe(true);
    expect(game.getState().playerHand.length).toBe(playerCount - 1);
    assertConserved(game);
    expect(game.getState().phase).toBe("PLAYER_DRAW");
    expect(game.botDraw()).toBe(false); // not the bot's turn
  });

  test("out-of-range draw index is rejected", () => {
    const game = new OldMaidGame(42);
    expect(game.playerDraw(-1)).toBe(false);
    expect(game.playerDraw(game.getState().botHandCount)).toBe(false);
    expect(game.getState().phase).toBe("PLAYER_DRAW");
  });
});

describe("endgame", () => {
  test("bot dealt the unpaired queen loses immediately", () => {
    // Player: all hearts and diamonds — 13 complete pairs, hand empties.
    // Bot: all spades and clubs minus Q♣ — keeps only the odd Q♠.
    const player = suited(ALL_RANKS, [Suit.Hearts, Suit.Diamonds]);
    const bot = suited(ALL_RANKS, [Suit.Spades, Suit.Clubs]).filter(
      (c) => !(c.cardName === CardName.Queen && c.suit === Suit.Clubs),
    );
    const game = new OldMaidGame(1, interleave(player, bot));

    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winner).toBe("player");
    expect(state.oddCard!.cardName).toBe(CardName.Queen);
    expect(cardKey(state.oddCard!)).toBe(
      cardKey(card(CardName.Queen, Suit.Spades)),
    );
    assertConserved(game);
  });

  test("player stuck with the queen loses", () => {
    const game = new OldMaidGame(1, playerLosesDeck());
    // Post-deal: player holds [Q, 7♥], bot holds a lone 7.
    expect(game.playerDraw(0)).toBe(true); // drawn 7 pairs with 7♥

    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winner).toBe("computer");
    expect(state.playerHand.length).toBe(1);
    expect(state.playerHand[0]!.cardName).toBe(CardName.Queen);
    expect(state.oddCard!.cardName).toBe(CardName.Queen);
    assertConserved(game);
  });

  test("bot stuck with the queen loses after drawing resolves", () => {
    const game = new OldMaidGame(1, botLosesDeck());
    // Post-deal: player holds [6♥, 7♥]; bot holds a 6, a 7 and Q♠.
    const sixIndex = botHand(game).findIndex(
      (c) => c.cardName === CardName.Six,
    );
    expect(game.playerDraw(sixIndex)).toBe(true); // pairs away the sixes
    expect(game.getState().phase).toBe("BOT_DRAW");
    expect(game.botDraw()).toBe(true); // bot takes 7♥, pairs its sevens

    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    expect(state.winner).toBe("player");
    expect(state.botHandCount).toBe(1);
    expect(cardKey(state.oddCard!)).toBe(
      cardKey(card(CardName.Queen, Suit.Spades)),
    );
    assertConserved(game);
  });

  test("full seeded game: cards conserved at every step and the odd card is a Queen", () => {
    const game = new OldMaidGame(1234);
    let steps = 0;
    while (game.getState().phase !== "GAME_OVER" && steps < 500) {
      if (game.getState().phase === "PLAYER_DRAW") {
        expect(game.playerDraw(0)).toBe(true);
      } else {
        expect(game.botDraw()).toBe(true);
      }
      assertConserved(game);
      steps++;
    }

    const state = game.getState();
    expect(state.phase).toBe("GAME_OVER");
    const remaining = game.cardsInPlay();
    expect(remaining.length).toBe(1);
    expect(remaining[0]!.cardName).toBe(CardName.Queen);
    expect(state.oddCard).toBe(remaining[0]!);

    const playerHoldsMaid = state.playerHand.length === 1;
    expect(state.winner).toBe(playerHoldsMaid ? "computer" : "player");
  });
});

/**
 * Deck where the player keeps [Q, 7♥] and the bot keeps a lone 7:
 * the player's first draw must pair the sevens, leaving them the Old Maid.
 */
function playerLosesDeck(): PlayingCard[] {
  const nonQ7 = ALL_RANKS.filter(
    (r) => r !== CardName.Queen && r !== CardName.Seven,
  );
  const player = [
    card(CardName.Queen, Suit.Spades),
    card(CardName.Queen, Suit.Hearts),
    card(CardName.Queen, Suit.Diamonds),
    card(CardName.Seven, Suit.Hearts),
    ...suited(nonQ7, [Suit.Hearts, Suit.Diamonds]),
  ];
  const bot = [
    card(CardName.Seven, Suit.Spades),
    card(CardName.Seven, Suit.Diamonds),
    card(CardName.Seven, Suit.Clubs),
    ...suited(nonQ7, [Suit.Spades, Suit.Clubs]),
  ];
  return interleave(player, bot);
}

/**
 * Deck where the player keeps [6♥, 7♥] and the bot keeps [6, 7, Q♠]:
 * drawing the bot's 6 then letting the bot take the 7♥ strands the bot
 * with the Old Maid.
 */
function botLosesDeck(): PlayingCard[] {
  const base = ALL_RANKS.filter(
    (r) => r !== CardName.Queen && r !== CardName.Six && r !== CardName.Seven,
  );
  const baseNoEight = base.filter((r) => r !== CardName.Eight);
  const player = [
    ...suited(base, [Suit.Hearts, Suit.Diamonds]),
    card(CardName.Queen, Suit.Hearts),
    card(CardName.Queen, Suit.Diamonds),
    card(CardName.Six, Suit.Hearts),
    card(CardName.Seven, Suit.Hearts),
    card(CardName.Eight, Suit.Spades),
    card(CardName.Eight, Suit.Clubs),
  ];
  const bot = [
    ...suited(baseNoEight, [Suit.Spades, Suit.Clubs]),
    card(CardName.Six, Suit.Spades),
    card(CardName.Six, Suit.Diamonds),
    card(CardName.Six, Suit.Clubs),
    card(CardName.Seven, Suit.Spades),
    card(CardName.Seven, Suit.Diamonds),
    card(CardName.Seven, Suit.Clubs),
    card(CardName.Queen, Suit.Spades),
  ];
  return interleave(player, bot);
}
