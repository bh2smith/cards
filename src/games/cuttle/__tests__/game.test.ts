import { test, expect, describe } from "bun:test";
import { PlayingCard, CardName, Suit } from "typedeck";
import { CuttleGame } from "../game";
import {
  type CuttleState,
  type Field,
  type FieldCard,
  emptyField,
  cardKey,
  cardActions,
  twoTargets,
  nineTargets,
} from "../types";

const C = (name: CardName, suit: Suit) => new PlayingCard(name, suit);
const key = (name: CardName, suit: Suit) => cardKey(C(name, suit));
const fc = (
  card: PlayingCard,
  owner: "player" | "computer" = "player",
): FieldCard => ({
  card,
  owner,
  jacks: [],
});

/** Reach in and replace the dealt state with a controlled one. */
function setup(game: CuttleGame, patch: Partial<CuttleState>): CuttleState {
  const s = game.getState() as CuttleState;
  Object.assign(s, {
    phase: "PLAYER_TURN",
    turn: "player",
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

describe("deal", () => {
  test("starter gets 5, opponent gets 6, rest in deck", () => {
    const s = new CuttleGame("player").getState();
    expect(s.hands.player.length).toBe(5);
    expect(s.hands.computer.length).toBe(6);
    expect(s.deck.length).toBe(52 - 11);
    expect(s.phase).toBe("PLAYER_TURN");

    const all = [...s.hands.player, ...s.hands.computer, ...s.deck];
    expect(new Set(all.map(cardKey)).size).toBe(52);
  });

  test("computer starter takes the bot turn", () => {
    const s = new CuttleGame("computer").getState();
    expect(s.phase).toBe("BOT_TURN");
    expect(s.hands.computer.length).toBe(5);
    expect(s.hands.player.length).toBe(6);
  });
});

describe("points", () => {
  test("playing points adds to the field and ends the turn", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Seven, Suit.Hearts)], computer: [] },
    });
    expect(game.playerPoints(key(CardName.Seven, Suit.Hearts))).toBe(true);
    const s = game.getState();
    expect(s.fields.player.points.length).toBe(1);
    expect(game.total("player")).toBe(7);
    expect(s.phase).toBe("BOT_TURN");
  });

  test("reaching 21 wins immediately", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Ten, Suit.Hearts)], computer: [] },
      fields: {
        player: {
          ...emptyField(),
          points: [
            fc(C(CardName.Six, Suit.Clubs)),
            fc(C(CardName.Five, Suit.Clubs)),
          ],
        },
        computer: emptyField(),
      },
    });
    // 6 + 5 = 11, + 10 = 21 ≥ 21
    expect(game.playerPoints(key(CardName.Ten, Suit.Hearts))).toBe(true);
    const s = game.getState();
    expect(s.phase).toBe("GAME_OVER");
    expect(s.winner).toBe("player");
  });
});

describe("kings lower the win threshold", () => {
  test("a king can win the game", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.King, Suit.Spades)], computer: [] },
      fields: {
        player: {
          ...emptyField(),
          points: [
            fc(C(CardName.Ten, Suit.Hearts)),
            fc(C(CardName.Five, Suit.Hearts)),
          ],
        },
        computer: emptyField(),
      },
    });
    // 15 points, one king lowers threshold to 14 → win.
    expect(game.threshold("player")).toBe(21);
    expect(game.playerKing(key(CardName.King, Suit.Spades))).toBe(true);
    expect(game.getState().winner).toBe("player");
  });
});

describe("scuttle", () => {
  test("equal rank scuttles only with the stronger suit", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Five, Suit.Spades)], computer: [] },
      fields: {
        player: emptyField(),
        computer: {
          ...emptyField(),
          points: [fc(C(CardName.Five, Suit.Clubs), "computer")],
        },
      },
    });
    expect(
      game.playerScuttle(
        key(CardName.Five, Suit.Spades),
        key(CardName.Five, Suit.Clubs),
      ),
    ).toBe(true);
    const s = game.getState();
    expect(s.fields.computer.points.length).toBe(0);
    expect(s.scrap.map(cardKey).sort()).toEqual(
      [key(CardName.Five, Suit.Spades), key(CardName.Five, Suit.Clubs)].sort(),
    );
  });

  test("a weaker suit cannot scuttle an equal rank", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Five, Suit.Clubs)], computer: [] },
      fields: {
        player: emptyField(),
        computer: {
          ...emptyField(),
          points: [fc(C(CardName.Five, Suit.Spades), "computer")],
        },
      },
    });
    expect(
      game.playerScuttle(
        key(CardName.Five, Suit.Clubs),
        key(CardName.Five, Suit.Spades),
      ),
    ).toBe(false);
  });
});

describe("jacks", () => {
  test("a jack steals an opponent point card", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Jack, Suit.Clubs)], computer: [] },
      fields: {
        player: emptyField(),
        computer: {
          ...emptyField(),
          points: [fc(C(CardName.Ten, Suit.Hearts), "computer")],
        },
      },
    });
    expect(
      game.playerJack(
        key(CardName.Jack, Suit.Clubs),
        key(CardName.Ten, Suit.Hearts),
      ),
    ).toBe(true);
    const s = game.getState();
    expect(s.fields.computer.points.length).toBe(0);
    expect(s.fields.player.points.length).toBe(1);
    expect(game.total("player")).toBe(10);
  });

  test("a queen blocks the steal", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Jack, Suit.Clubs)], computer: [] },
      fields: {
        player: emptyField(),
        computer: {
          ...emptyField(),
          points: [fc(C(CardName.Ten, Suit.Hearts), "computer")],
          queens: [fc(C(CardName.Queen, Suit.Spades), "computer")],
        },
      },
    });
    expect(
      game.playerJack(
        key(CardName.Jack, Suit.Clubs),
        key(CardName.Ten, Suit.Hearts),
      ),
    ).toBe(false);
  });
});

describe("one-offs", () => {
  test("Ace scraps all point cards on both sides (uncountered)", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: {
        player: [C(CardName.Ace, Suit.Spades)],
        computer: [C(CardName.King, Suit.Hearts)],
      },
      fields: {
        player: { ...emptyField(), points: [fc(C(CardName.Nine, Suit.Clubs))] },
        computer: {
          ...emptyField(),
          points: [fc(C(CardName.Eight, Suit.Diamonds), "computer")],
        },
      },
    });
    expect(game.playerOneOff(key(CardName.Ace, Suit.Spades))).toBe(true);
    const s = game.getState();
    expect(s.fields.player.points.length).toBe(0);
    expect(s.fields.computer.points.length).toBe(0);
    expect(s.phase).toBe("BOT_TURN"); // turn passed; no counter available
  });

  test("Three retrieves a chosen card from the scrap", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Three, Suit.Spades)], computer: [] },
      scrap: [C(CardName.King, Suit.Hearts)],
    });
    expect(
      game.playerOneOff(
        key(CardName.Three, Suit.Spades),
        key(CardName.King, Suit.Hearts),
      ),
    ).toBe(true);
    const s = game.getState();
    expect(s.hands.player.map(cardKey)).toContain(
      key(CardName.King, Suit.Hearts),
    );
    // The Three itself is now in the scrap; the King is not.
    expect(s.scrap.map(cardKey)).not.toContain(key(CardName.King, Suit.Hearts));
  });

  test("Six scraps every royal and glasses", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Six, Suit.Spades)], computer: [] },
      fields: {
        player: {
          ...emptyField(),
          kings: [fc(C(CardName.King, Suit.Clubs))],
          points: [fc(C(CardName.Two, Suit.Hearts))],
        },
        computer: {
          ...emptyField(),
          queens: [fc(C(CardName.Queen, Suit.Diamonds), "computer")],
          glasses: [fc(C(CardName.Eight, Suit.Spades), "computer")],
        },
      },
    });
    expect(game.playerOneOff(key(CardName.Six, Suit.Spades))).toBe(true);
    const s = game.getState();
    expect(s.fields.player.kings.length).toBe(0);
    expect(s.fields.computer.queens.length).toBe(0);
    expect(s.fields.computer.glasses.length).toBe(0);
    // Points are untouched by a Six.
    expect(s.fields.player.points.length).toBe(1);
  });

  test("Five discards nothing extra for the player and draws three", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Five, Suit.Spades)], computer: [] },
      deck: [
        C(CardName.Two, Suit.Hearts),
        C(CardName.Three, Suit.Hearts),
        C(CardName.Four, Suit.Hearts),
      ],
    });
    expect(game.playerOneOff(key(CardName.Five, Suit.Spades))).toBe(true);
    // Player had only the Five; after playing it the hand is empty, so it draws 3.
    expect(game.getState().hands.player.length).toBe(3);
  });
});

describe("Two counters resolve by parity", () => {
  test("a single counter negates the one-off", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: {
        player: [C(CardName.Ace, Suit.Spades)],
        computer: [C(CardName.Two, Suit.Clubs)],
      },
      fields: {
        player: emptyField(),
        computer: {
          ...emptyField(),
          points: [
            fc(C(CardName.Ten, Suit.Hearts), "computer"),
            fc(C(CardName.Ten, Suit.Diamonds), "computer"),
          ],
        },
      },
    });
    // Player (behind 0-20) plays Ace; the bot counters with its Two.
    expect(game.playerOneOff(key(CardName.Ace, Suit.Spades))).toBe(true);
    expect(game.getState().phase).toBe("PLAYER_COUNTER");
    // Player has no second Two, so declines → one counter (odd) → Ace negated.
    expect(game.playerDeclineCounter()).toBe(true);
    const s = game.getState();
    expect(s.fields.computer.points.length).toBe(2); // points survive
    expect(s.phase).toBe("BOT_TURN");
  });

  test("countering the counter lets the one-off resolve", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: {
        player: [C(CardName.Ace, Suit.Spades), C(CardName.Two, Suit.Diamonds)],
        computer: [C(CardName.Two, Suit.Clubs)],
      },
      fields: {
        player: emptyField(),
        computer: {
          ...emptyField(),
          points: [
            fc(C(CardName.Ten, Suit.Hearts), "computer"),
            fc(C(CardName.Ten, Suit.Diamonds), "computer"),
          ],
        },
      },
    });
    expect(game.playerOneOff(key(CardName.Ace, Suit.Spades))).toBe(true);
    expect(game.getState().phase).toBe("PLAYER_COUNTER");
    // Player counters back: 2 counters (even) → Ace resolves.
    expect(game.playerCounter(key(CardName.Two, Suit.Diamonds))).toBe(true);
    const s = game.getState();
    expect(s.fields.computer.points.length).toBe(0); // wiped
  });
});

describe("queen targeting and frozen cards", () => {
  test("a frozen card cannot be played", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Nine, Suit.Spades)], computer: [] },
      frozenKey: key(CardName.Nine, Suit.Spades),
      frozenOwner: "player",
    });
    expect(game.playerPoints(key(CardName.Nine, Suit.Spades))).toBe(false);
  });

  test("Nine returns an opponent point card to its owner, frozen", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [C(CardName.Nine, Suit.Spades)], computer: [] },
      fields: {
        player: emptyField(),
        computer: {
          ...emptyField(),
          points: [fc(C(CardName.Ten, Suit.Hearts), "computer")],
        },
      },
    });
    expect(
      game.playerOneOff(
        key(CardName.Nine, Suit.Spades),
        key(CardName.Ten, Suit.Hearts),
      ),
    ).toBe(true);
    const s = game.getState();
    expect(s.fields.computer.points.length).toBe(0);
    expect(s.hands.computer.map(cardKey)).toContain(
      key(CardName.Ten, Suit.Hearts),
    );
    expect(s.frozenOwner).toBe("computer");
    expect(s.frozenKey).toBe(key(CardName.Ten, Suit.Hearts));
  });
});

describe("draw limits and stalemate", () => {
  test("cannot draw at the hand limit", () => {
    const game = new CuttleGame("player");
    const hand = Array.from({ length: 8 }, (_, i) =>
      C(i as CardName, Suit.Hearts),
    );
    setup(game, {
      hands: { player: hand, computer: [] },
      deck: [C(CardName.King, Suit.Spades)],
    });
    expect(game.playerDraw()).toBe(false);
  });

  test("three consecutive passes end the game by points", () => {
    const game = new CuttleGame("player");
    setup(game, {
      hands: { player: [], computer: [] },
      deck: [],
      fields: {
        player: { ...emptyField(), points: [fc(C(CardName.Ten, Suit.Hearts))] },
        computer: emptyField(),
      },
    });
    expect(game.playerPass()).toBe(true); // pass 1
    expect(game.getState().phase).toBe("BOT_TURN");
    game.botTurn(); // bot has nothing → pass 2
    expect(game.playerPass()).toBe(true); // pass 3 → stalemate
    const s = game.getState();
    expect(s.phase).toBe("GAME_OVER");
    expect(s.winner).toBe("player"); // more points
  });
});

describe("full-game fuzz", () => {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

  const fieldCards = (f: Field): PlayingCard[] => {
    const out: PlayingCard[] = [];
    for (const fc of [...f.points, ...f.queens, ...f.kings, ...f.glasses])
      out.push(fc.card, ...fc.jacks);
    return out;
  };

  const oneOffTarget = (s: CuttleState, c: PlayingCard): string | undefined => {
    if (c.cardName === CardName.Two) {
      const t = twoTargets(s, "player");
      return t.length ? cardKey(pick(t).card) : undefined;
    }
    if (c.cardName === CardName.Nine) {
      const t = nineTargets(s, "player");
      return t.length ? cardKey(pick(t).card) : undefined;
    }
    if (c.cardName === CardName.Three)
      return s.scrap.length ? cardKey(pick(s.scrap)) : undefined;
    return undefined;
  };

  /** Make one random legal move for the player in whatever phase they're in. */
  const playerMove = (game: CuttleGame): void => {
    const s = game.getState();

    if (s.phase === "PLAYER_COUNTER") {
      const twos = s.hands.player.filter((c) => c.cardName === CardName.Two);
      if (twos.length && Math.random() < 0.4)
        game.playerCounter(cardKey(pick(twos)));
      else game.playerDeclineCounter();
      return;
    }

    if (s.phase === "PLAYER_DISCARD") {
      const need = Math.min(s.discardCount, s.hands.player.length);
      game.playerDiscard(s.hands.player.slice(0, need).map(cardKey));
      return;
    }

    if (s.phase === "PLAYER_SEVEN") {
      for (const c of s.sevenCards ?? []) {
        const a = cardActions(s, "player", c);
        const k = cardKey(c);
        if (a.points && game.playerSeven(k, "points")) return;
        if (a.king && game.playerSeven(k, "king")) return;
        if (a.queen && game.playerSeven(k, "queen")) return;
        if (a.glasses && game.playerSeven(k, "glasses")) return;
        if (
          a.scuttle.length &&
          game.playerSeven(k, "scuttle", cardKey(pick(a.scuttle).card))
        )
          return;
        if (
          a.jack.length &&
          game.playerSeven(k, "jack", cardKey(pick(a.jack).card))
        )
          return;
        if (
          a.oneOff.playable &&
          game.playerSeven(k, "oneoff", oneOffTarget(s, c))
        )
          return;
      }
      throw new Error("PLAYER_SEVEN reached with no playable card");
    }

    // PLAYER_TURN
    const moves: Array<() => boolean> = [];
    for (const c of s.hands.player) {
      if (game.isFrozen("player", c)) continue;
      const k = cardKey(c);
      const a = cardActions(s, "player", c);
      if (a.points) moves.push(() => game.playerPoints(k));
      for (const t of a.scuttle)
        moves.push(() => game.playerScuttle(k, cardKey(t.card)));
      for (const t of a.jack)
        moves.push(() => game.playerJack(k, cardKey(t.card)));
      if (a.king) moves.push(() => game.playerKing(k));
      if (a.queen) moves.push(() => game.playerQueen(k));
      if (a.glasses) moves.push(() => game.playerGlasses(k));
      if (a.oneOff.playable)
        moves.push(() => game.playerOneOff(k, oneOffTarget(s, c)));
    }
    if (s.deck.length > 0 && s.hands.player.length < 8)
      moves.push(() => game.playerDraw());
    if (s.deck.length === 0) moves.push(() => game.playerPass());

    if (moves.length === 0) {
      // Only possible with a full hand of frozen/unplayable cards and empty deck.
      game.playerPass();
      return;
    }
    pick(moves)();
  };

  test("random games terminate, never crash, and conserve all 52 cards", () => {
    for (let g = 0; g < 80; g++) {
      const game = new CuttleGame(Math.random() < 0.5 ? "player" : "computer");
      let steps = 0;
      while (game.getState().phase !== "GAME_OVER") {
        if (game.getState().phase === "BOT_TURN") game.botTurn();
        else playerMove(game);
        if (++steps > 5000) throw new Error("game failed to terminate");
      }
      const s = game.getState();
      const all = [
        ...s.deck,
        ...s.scrap,
        ...s.hands.player,
        ...s.hands.computer,
        ...fieldCards(s.fields.player),
        ...fieldCards(s.fields.computer),
      ];
      expect(all.length).toBe(52);
      expect(new Set(all.map(cardKey)).size).toBe(52);
      expect(["player", "computer", null]).toContain(s.winner);
    }
  });
});
