import type { PlayingCard } from "typedeck";
import { createDeck, shuffle, seededRng, cardOrder } from "../../shared/deck";
import type { GolfState, GolfOptions } from "./types";

const COLUMNS = 7;
const ROWS = 5;

export class GolfGame {
  private state: GolfState;

  constructor(options?: Partial<GolfOptions>) {
    this.state = this.initialState({ wrapRank: true, ...options });
  }

  private initialState(options: GolfOptions): GolfState {
    return {
      phase: "PLAYING",
      tableau: [],
      stock: [],
      waste: null,
      won: false,
      options,
      message: "",
      winner: null,
    };
  }

  getState(): Readonly<GolfState> {
    return this.state;
  }

  deal(seed?: number): void {
    const deck = shuffle(
      createDeck(),
      seed === undefined ? undefined : seededRng(seed),
    );

    const tableau: PlayingCard[][] = [];
    let idx = 0;
    for (let col = 0; col < COLUMNS; col++) {
      tableau.push(deck.slice(idx, idx + ROWS));
      idx += ROWS;
    }

    const waste = deck[idx]!;
    idx++;
    const stock = deck.slice(idx);

    this.state = {
      ...this.state,
      phase: "PLAYING",
      tableau,
      stock,
      waste,
      won: false,
      message: "Remove cards one rank above or below the waste card.",
      winner: null,
    };
  }

  canPlay(card: PlayingCard, waste: PlayingCard): boolean {
    const cardRank = cardOrder(card);
    const wasteRank = cardOrder(waste);
    const diff = Math.abs(cardRank - wasteRank);
    if (diff === 1) return true;
    if (this.state.options.wrapRank && diff === 12) return true;
    return false;
  }

  playCard(colIndex: number): void {
    if (this.state.phase !== "PLAYING") return;

    const col = this.state.tableau[colIndex];
    if (!col || col.length === 0) return;
    if (!this.state.waste) return;

    const card = col[col.length - 1]!;
    if (!this.canPlay(card, this.state.waste)) return;

    col.pop();
    this.state.waste = card;
    this.state.message = "Remove cards one rank above or below the waste card.";
    this.checkEndConditions();
  }

  canDrawFromStock(): boolean {
    return this.state.phase === "PLAYING" && this.state.stock.length > 0;
  }

  drawFromStock(): void {
    if (!this.canDrawFromStock()) return;

    this.state.waste = this.state.stock.pop()!;
    this.state.message = "Remove cards one rank above or below the waste card.";
    this.checkEndConditions();
  }

  hasAnyMove(): boolean {
    if (this.state.stock.length > 0) return true;
    if (!this.state.waste) return false;
    for (const col of this.state.tableau) {
      if (
        col.length > 0 &&
        this.canPlay(col[col.length - 1]!, this.state.waste)
      ) {
        return true;
      }
    }
    return false;
  }

  cardsRemaining(): number {
    return this.state.tableau.reduce((sum, col) => sum + col.length, 0);
  }

  private checkEndConditions(): void {
    if (this.cardsRemaining() === 0) {
      this.state.won = true;
      this.state.phase = "GAME_OVER";
      this.state.message = "You cleared the tableau! You win!";
      return;
    }
    if (!this.hasAnyMove()) {
      this.state.won = false;
      this.state.phase = "GAME_OVER";
      this.state.message = `No moves left. ${this.cardsRemaining()} cards remaining.`;
    }
  }
}
