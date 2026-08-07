import { CardName, Suit, type PlayingCard } from "typedeck";
import {
  createDeck,
  shuffle,
  seededRng,
  cardOrder,
  RANK_DISPLAY,
  SUIT_SYMBOL,
} from "../../shared/deck";
import type { OldMaidState } from "./types";

function cardLabel(card: PlayingCard): string {
  return `${RANK_DISPLAY[card.cardName]}${SUIT_SYMBOL[card.suit]}`;
}

function sortHand(hand: PlayingCard[]): void {
  hand.sort((a, b) => cardOrder(a) - cardOrder(b) || a.suit - b.suit);
}

/**
 * Remove every rank-pair from the hand (two at a time — three of a kind lays
 * one pair and keeps one card). Returns the number of pairs laid.
 */
function layPairs(hand: PlayingCard[]): number {
  const byRank = new Map<CardName, PlayingCard[]>();
  for (const card of hand) {
    const group = byRank.get(card.cardName) ?? [];
    group.push(card);
    byRank.set(card.cardName, group);
  }

  let pairs = 0;
  hand.length = 0;
  for (const group of byRank.values()) {
    pairs += Math.floor(group.length / 2);
    if (group.length % 2 === 1) hand.push(group[group.length - 1]!);
  }
  return pairs;
}

export class OldMaidGame {
  private state: OldMaidState;
  private botHand: PlayingCard[];
  private rng: () => number;

  constructor(seed?: number, deck?: PlayingCard[]) {
    this.rng = seed === undefined ? Math.random : seededRng(seed);

    // 51 cards: a full deck minus the Queen of Clubs.
    const cards =
      deck ??
      shuffle(
        createDeck().filter(
          (c) => !(c.cardName === CardName.Queen && c.suit === Suit.Clubs),
        ),
        this.rng,
      );

    const playerHand: PlayingCard[] = [];
    const botHand: PlayingCard[] = [];
    cards.forEach((card, i) => (i % 2 === 0 ? playerHand : botHand).push(card));

    this.botHand = botHand;
    this.state = {
      phase: "PLAYER_DRAW",
      playerHand,
      botHandCount: 0,
      botDrawableIndices: [],
      playerPairs: layPairs(playerHand),
      botPairs: layPairs(botHand),
      oddCard: null,
      message: "",
      winner: null,
    };
    sortHand(playerHand);
    this.syncBot();

    if (!this.checkEnd()) {
      this.state.message =
        "Pairs laid. Pick a card from the computer's hand — avoid the Old Maid!";
    }
  }

  getState(): Readonly<OldMaidState> {
    return this.state;
  }

  /** All cards still held (player's then bot's) — for endgame and bookkeeping. */
  cardsInPlay(): PlayingCard[] {
    return [...this.state.playerHand, ...this.botHand];
  }

  playerDraw(index: number): boolean {
    if (this.state.phase !== "PLAYER_DRAW") return false;
    if (index < 0 || index >= this.botHand.length) return false;

    const card = this.botHand.splice(index, 1)[0]!;
    this.state.playerHand.push(card);
    const laid = layPairs(this.state.playerHand);
    this.state.playerPairs += laid;
    sortHand(this.state.playerHand);
    this.syncBot();

    if (this.checkEnd()) return true;
    this.state.phase = "BOT_DRAW";
    this.state.message = laid
      ? `You drew the ${cardLabel(card)} and laid a pair. Computer's turn…`
      : `You drew the ${cardLabel(card)} — no pair. Computer's turn…`;
    return true;
  }

  botDraw(): boolean {
    if (this.state.phase !== "BOT_DRAW") return false;
    const hand = this.state.playerHand;
    if (hand.length === 0) return false;

    const index = Math.floor(this.rng() * hand.length);
    this.botHand.push(hand.splice(index, 1)[0]!);
    const laid = layPairs(this.botHand);
    this.state.botPairs += laid;
    // Silent re-shuffle so the player can't track the Queen between turns.
    this.botHand = shuffle(this.botHand, this.rng);
    this.syncBot();

    if (this.checkEnd()) return true;
    this.state.phase = "PLAYER_DRAW";
    this.state.message = laid
      ? "The computer took a card and laid a pair. Pick a card."
      : "The computer took a card. Pick a card.";
    return true;
  }

  private syncBot(): void {
    this.state.botHandCount = this.botHand.length;
    this.state.botDrawableIndices = this.botHand.map((_, i) => i);
  }

  /** The game is decided once a single card — the odd Queen — remains in play. */
  private checkEnd(): boolean {
    const remaining = this.cardsInPlay();
    if (remaining.length !== 1) return false;

    const playerHoldsMaid = this.state.playerHand.length === 1;
    this.state.phase = "GAME_OVER";
    this.state.oddCard = remaining[0]!;
    this.state.winner = playerHoldsMaid ? "computer" : "player";
    this.state.message = playerHoldsMaid
      ? "You're left holding the Old Maid — the computer wins!"
      : "The computer is stuck with the Old Maid — you win!";
    return true;
  }
}
