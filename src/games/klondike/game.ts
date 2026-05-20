import type { PlayingCard } from "typedeck";
import { CardName, Suit } from "typedeck";
import { createDeck, shuffle, cardOrder, isRed } from "../../shared/deck";
import type { KlondikeState, TableauColumn } from "./types";

const TABLEAU_COLS = 7;

const ALL_SUITS = [Suit.Clubs, Suit.Spades, Suit.Diamonds, Suit.Hearts];

export class KlondikeGame {
  private state: KlondikeState;

  constructor() {
    this.state = this.initialState();
  }

  private initialState(): KlondikeState {
    return {
      phase: "PLAYING",
      tableau: [],
      foundations: [[], [], [], []],
      stock: [],
      waste: [],
      selected: null,
      won: false,
      moves: 0,
      message: "",
      winner: null,
    };
  }

  getState(): Readonly<KlondikeState> {
    return this.state;
  }

  deal(): void {
    const deck = shuffle(createDeck());

    const tableau: TableauColumn[] = [];
    let idx = 0;
    for (let col = 0; col < TABLEAU_COLS; col++) {
      const faceDown = deck.slice(idx, idx + col);
      idx += col;
      const faceUp = [deck[idx]!];
      idx++;
      tableau.push({ faceDown, faceUp });
    }

    this.state = {
      ...this.state,
      phase: "PLAYING",
      tableau,
      foundations: [[], [], [], []],
      stock: deck.slice(idx),
      waste: [],
      selected: null,
      won: false,
      moves: 0,
      message: "Move cards to build foundations from Ace to King by suit.",
      winner: null,
    };
  }

  drawStock(): void {
    if (this.state.phase !== "PLAYING") return;
    this.state.selected = null;

    if (this.state.stock.length > 0) {
      this.state.waste.push(this.state.stock.pop()!);
      this.state.moves++;
      this.state.message =
        "Move cards to build foundations from Ace to King by suit.";
    } else if (this.state.waste.length > 0) {
      this.state.stock = this.state.waste.reverse();
      this.state.waste = [];
      this.state.message = "Stock recycled.";
    }
  }

  selectWaste(): void {
    if (this.state.phase !== "PLAYING") return;
    if (this.state.waste.length === 0) return;

    if (this.state.selected !== null && this.state.selected.type === "waste") {
      this.state.selected = null;
      this.state.message =
        "Move cards to build foundations from Ace to King by suit.";
      return;
    }

    this.state.selected = { type: "waste" };
    this.state.message = "Select a destination column or foundation.";
  }

  selectTableau(col: number, cardIndex: number): void {
    if (this.state.phase !== "PLAYING") return;
    const column = this.state.tableau[col];
    if (!column) return;

    // cardIndex is relative to faceUp array
    if (cardIndex < 0 || cardIndex >= column.faceUp.length) return;

    // If clicking on already-selected card, deselect
    if (
      this.state.selected !== null &&
      this.state.selected.type === "tableau" &&
      this.state.selected.col === col &&
      this.state.selected.cardIndex === cardIndex
    ) {
      this.state.selected = null;
      this.state.message =
        "Move cards to build foundations from Ace to King by suit.";
      return;
    }

    // If we have a selection, try to move to this column
    if (this.state.selected !== null) {
      if (this.state.selected.type === "waste") {
        if (this.playWasteToTableau(col)) return;
      } else if (this.state.selected.type === "tableau") {
        if (
          this.moveTableauToTableau(
            this.state.selected.col,
            this.state.selected.cardIndex,
            col,
          )
        )
          return;
      }
    }

    // Select this card/sequence
    this.state.selected = { type: "tableau", col, cardIndex };
    this.state.message = "Select a destination column or foundation.";
  }

  selectFoundation(suitIndex: number): void {
    if (this.state.phase !== "PLAYING") return;

    if (this.state.selected === null) return;

    if (this.state.selected.type === "waste") {
      this.playWasteToFoundation(suitIndex);
    } else if (this.state.selected.type === "tableau") {
      this.playTableauToFoundation(this.state.selected.col, suitIndex);
    }
  }

  playWasteToTableau(colIndex: number): boolean {
    if (this.state.phase !== "PLAYING") return false;
    if (this.state.waste.length === 0) return false;

    const card = this.state.waste[this.state.waste.length - 1]!;
    const column = this.state.tableau[colIndex];
    if (!column) return false;

    if (!this.canPlaceOnTableau(card, column)) return false;

    column.faceUp.push(this.state.waste.pop()!);
    this.state.selected = null;
    this.state.moves++;
    this.autoFlip();
    this.state.message =
      "Move cards to build foundations from Ace to King by suit.";
    this.checkWin();
    return true;
  }

  playWasteToFoundation(suitIndex: number): boolean {
    if (this.state.phase !== "PLAYING") return false;
    if (this.state.waste.length === 0) return false;

    const card = this.state.waste[this.state.waste.length - 1]!;
    if (!this.canPlaceOnFoundation(card, suitIndex)) return false;

    this.state.foundations[suitIndex]!.push(this.state.waste.pop()!);
    this.state.selected = null;
    this.state.moves++;
    this.autoFlip();
    this.state.message = "Card placed on foundation!";
    this.checkWin();
    return true;
  }

  playTableauToFoundation(colIndex: number, suitIndex: number): boolean {
    if (this.state.phase !== "PLAYING") return false;

    const column = this.state.tableau[colIndex];
    if (!column || column.faceUp.length === 0) return false;

    const card = column.faceUp[column.faceUp.length - 1]!;
    if (!this.canPlaceOnFoundation(card, suitIndex)) return false;

    this.state.foundations[suitIndex]!.push(column.faceUp.pop()!);
    this.state.selected = null;
    this.state.moves++;
    this.autoFlip();
    this.state.message = "Card placed on foundation!";
    this.checkWin();
    return true;
  }

  moveTableauToTableau(
    fromCol: number,
    cardIndex: number,
    toCol: number,
  ): boolean {
    if (this.state.phase !== "PLAYING") return false;
    if (fromCol === toCol) return false;

    const from = this.state.tableau[fromCol];
    const to = this.state.tableau[toCol];
    if (!from || !to) return false;
    if (cardIndex < 0 || cardIndex >= from.faceUp.length) return false;

    const movingCard = from.faceUp[cardIndex]!;
    if (!this.canPlaceOnTableau(movingCard, to)) return false;

    const moving = from.faceUp.splice(cardIndex);
    to.faceUp.push(...moving);
    this.state.selected = null;
    this.state.moves++;
    this.autoFlip();
    this.state.message =
      "Move cards to build foundations from Ace to King by suit.";
    this.checkWin();
    return true;
  }

  autoFlip(): void {
    for (const column of this.state.tableau) {
      if (column.faceUp.length === 0 && column.faceDown.length > 0) {
        column.faceUp.push(column.faceDown.pop()!);
      }
    }
  }

  foundationCount(): number {
    return this.state.foundations.reduce((sum, pile) => sum + pile.length, 0);
  }

  private canPlaceOnTableau(card: PlayingCard, column: TableauColumn): boolean {
    if (column.faceUp.length === 0 && column.faceDown.length === 0) {
      // Empty column: only Kings
      return card.cardName === CardName.King;
    }

    if (column.faceUp.length === 0) return false;

    const topCard = column.faceUp[column.faceUp.length - 1]!;
    // Must be alternating colors and one rank lower
    if (isRed(card) === isRed(topCard)) return false;
    if (cardOrder(topCard) - cardOrder(card) !== 1) return false;
    return true;
  }

  private canPlaceOnFoundation(card: PlayingCard, suitIndex: number): boolean {
    const suit = ALL_SUITS[suitIndex]!;
    if (card.suit !== suit) return false;

    const pile = this.state.foundations[suitIndex]!;
    if (pile.length === 0) {
      return card.cardName === CardName.Ace;
    }

    const topCard = pile[pile.length - 1]!;
    return cardOrder(card) - cardOrder(topCard) === 1;
  }

  canAutoFoundation(card: PlayingCard): number {
    for (let i = 0; i < 4; i++) {
      if (this.canPlaceOnFoundation(card, i)) return i;
    }
    return -1;
  }

  giveUp(): void {
    if (this.state.phase !== "PLAYING") return;
    this.state.won = false;
    this.state.phase = "GAME_OVER";
    const placed = this.foundationCount();
    this.state.message = `Gave up. ${placed}/52 cards placed in ${this.state.moves} moves.`;
  }

  private checkWin(): void {
    if (this.foundationCount() === 52) {
      this.state.won = true;
      this.state.phase = "GAME_OVER";
      this.state.message = `You win! All cards placed in ${this.state.moves} moves.`;
    }
  }
}
