import type { CardName, PlayingCard } from "typedeck";
import type { Player } from "../../shared/types";
import {
  RANK_DISPLAY,
  createDeck,
  seededRng,
  shuffle,
} from "../../shared/deck";
import { chooseAsk } from "./ai";
import {
  type GoFishState,
  BOOK_SIZE,
  HAND_SIZE,
  TOTAL_BOOKS,
  countRank,
  sortHand,
} from "./types";

export interface AskOutcome {
  rank: CardName;
  /** Cards taken from the opponent (0 means "go fish"). */
  gained: number;
  /** Card drawn from the pond on a go fish, if any remained. */
  fished: PlayingCard | null;
  /** The fished card matched the asked rank, so the asker goes again. */
  lucky: boolean;
  turnEnded: boolean;
}

export class GoFishGame {
  private state: GoFishState;
  private rng: () => number;
  /** Ranks the bot believes the player still holds (from the player's asks). */
  private botMemory = new Set<CardName>();

  constructor(seed?: number) {
    this.rng = seed === undefined ? Math.random : seededRng(seed);
    this.state = this.buildDeal();
  }

  getState(): Readonly<GoFishState> {
    return this.state;
  }

  getBotMemory(): ReadonlySet<CardName> {
    return this.botMemory;
  }

  newGame(seed?: number): void {
    if (seed !== undefined) this.rng = seededRng(seed);
    this.botMemory.clear();
    this.state = this.buildDeal();
  }

  /** Ask the bot for a rank the player holds. Returns null if illegal. */
  playerAsk(rank: CardName): AskOutcome | null {
    if (this.state.phase !== "PLAYER_TURN") return null;
    if (countRank(this.state.playerHand, rank) === 0) return null;

    this.botMemory.add(rank);
    return this.resolveAsk("player", rank);
  }

  /** Perform one bot ask (the UI calls this repeatedly while phase is BOT_TURN). */
  botAsk(): AskOutcome {
    if (this.state.phase !== "BOT_TURN") throw new Error("Not bot's turn");
    const rank = chooseAsk(this.state.computerHand, this.botMemory, this.rng);
    return this.resolveAsk("computer", rank);
  }

  private buildDeal(): GoFishState {
    const deck = shuffle(createDeck(), this.rng);
    this.state = {
      phase: "PLAYER_TURN",
      currentTurn: "player",
      playerHand: deck.slice(0, HAND_SIZE),
      computerHand: deck.slice(HAND_SIZE, HAND_SIZE * 2),
      pond: deck.slice(HAND_SIZE * 2),
      playerBooks: [],
      computerBooks: [],
      message: "Your turn — click a card to ask the bot for that rank.",
      winner: null,
    };
    sortHand(this.state.playerHand);
    this.layBooks("player");
    this.layBooks("computer");
    this.checkEnd();
    return this.state;
  }

  private resolveAsk(asker: Player, rank: CardName): AskOutcome {
    const askerHand =
      asker === "player" ? this.state.playerHand : this.state.computerHand;
    const targetHand =
      asker === "player" ? this.state.computerHand : this.state.playerHand;
    const label = RANK_DISPLAY[rank];
    const outcome: AskOutcome = {
      rank,
      gained: 0,
      fished: null,
      lucky: false,
      turnEnded: false,
    };

    const matches = targetHand.filter((c) => c.cardName === rank);
    if (matches.length > 0) {
      for (let i = targetHand.length - 1; i >= 0; i--) {
        if (targetHand[i]!.cardName === rank) targetHand.splice(i, 1);
      }
      askerHand.push(...matches);
      outcome.gained = matches.length;
      // The bot just took the player's copies, so the belief is spent.
      if (asker === "computer") this.botMemory.delete(rank);
      this.state.message =
        asker === "player"
          ? `You ask for ${label}s — the bot hands over ${matches.length}. Ask again!`
          : `The bot asks for ${label}s and takes ${matches.length} from you…`;
    } else {
      const drawn = this.state.pond.pop() ?? null;
      outcome.fished = drawn;
      if (drawn) {
        askerHand.push(drawn);
        outcome.lucky = drawn.cardName === rank;
      }
      if (outcome.lucky) {
        this.state.message =
          asker === "player"
            ? `Go fish… you catch the ${label} you asked for! Ask again.`
            : `The bot asks for ${label}s — go fish! It catches one and goes again…`;
      } else {
        outcome.turnEnded = true;
        this.state.message =
          asker === "player"
            ? drawn
              ? `No ${label}s — go fish. You draw a card. Bot's turn…`
              : `No ${label}s and the pond is empty. Bot's turn…`
            : `The bot asks for ${label}s — go fish. Your turn!`;
      }
    }

    sortHand(this.state.playerHand);
    this.layBooks(asker);

    if (this.checkEnd()) return outcome;
    if (outcome.turnEnded) {
      this.toTurn(asker === "player" ? "computer" : "player");
    } else {
      this.toTurn(asker);
    }
    return outcome;
  }

  /** Lay down every completed book of four in the given player's hand. */
  private layBooks(who: Player): void {
    const hand =
      who === "player" ? this.state.playerHand : this.state.computerHand;
    const books =
      who === "player" ? this.state.playerBooks : this.state.computerBooks;

    const counts = new Map<CardName, number>();
    for (const card of hand) {
      counts.set(card.cardName, (counts.get(card.cardName) ?? 0) + 1);
    }
    for (const [rank, n] of counts) {
      if (n < BOOK_SIZE) continue;
      for (let i = hand.length - 1; i >= 0; i--) {
        if (hand[i]!.cardName === rank) hand.splice(i, 1);
      }
      books.push(rank);
      // A booked rank is out of play — the bot stops chasing it.
      this.botMemory.delete(rank);
    }
  }

  private toTurn(who: Player): void {
    this.state.currentTurn = who;
    this.state.phase = who === "player" ? "PLAYER_TURN" : "BOT_TURN";
    this.ensureHand(who);
    this.checkEnd();
  }

  /** A player whose turn starts with an empty hand draws one from the pond. */
  private ensureHand(who: Player): void {
    const hand =
      who === "player" ? this.state.playerHand : this.state.computerHand;
    if (hand.length > 0 || this.state.pond.length === 0) return;
    hand.push(this.state.pond.pop()!);
    if (who === "player") sortHand(hand);
    this.state.message +=
      who === "player"
        ? " Your hand was empty — you drew from the pond."
        : " The bot's hand was empty — it drew from the pond.";
  }

  private checkEnd(): boolean {
    if (this.state.phase === "GAME_OVER") return true;
    const p = this.state.playerBooks.length;
    const c = this.state.computerBooks.length;
    const drained =
      this.state.pond.length === 0 &&
      (this.state.playerHand.length === 0 ||
        this.state.computerHand.length === 0);
    if (p + c < TOTAL_BOOKS && !drained) return false;

    this.state.phase = "GAME_OVER";
    if (p > c) {
      this.state.winner = "player";
      this.state.message = `You win — ${p} books to ${c}!`;
    } else if (c > p) {
      this.state.winner = "computer";
      this.state.message = `The bot wins — ${c} books to ${p}.`;
    } else {
      this.state.winner = null;
      this.state.message = `It's a tie — ${p} books each.`;
    }
    return true;
  }
}
