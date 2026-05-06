import type { PlayingCard } from "typedeck";
import { createDeck, shuffle, cardOrder } from "../../shared/deck";
import type { PyramidState, PyramidCard } from "./types";

const ROWS = 7;

export class PyramidGame {
  private state: PyramidState;

  constructor() {
    this.state = this.initialState();
  }

  private initialState(): PyramidState {
    return {
      phase: "PLAYING",
      pyramid: [],
      stock: [],
      waste: [],
      selected: null,
      won: false,
      message: "",
      winner: null,
    };
  }

  getState(): Readonly<PyramidState> {
    return this.state;
  }

  deal(): void {
    const deck = shuffle(createDeck());
    const pyramid: PyramidCard[][] = [];
    let idx = 0;
    for (let row = 0; row < ROWS; row++) {
      pyramid.push(deck.slice(idx, idx + row + 1));
      idx += row + 1;
    }

    this.state = {
      ...this.state,
      phase: "PLAYING",
      pyramid,
      stock: deck.slice(idx),
      waste: [],
      selected: null,
      won: false,
      message: "Pair exposed cards that sum to 13. Kings remove alone.",
      winner: null,
    };
  }

  isExposed(row: number, col: number): boolean {
    if (this.state.pyramid[row]?.[col] === null) return false;
    if (this.state.pyramid[row]?.[col] === undefined) return false;
    if (row === ROWS - 1) return true;
    const below = this.state.pyramid[row + 1]!;
    return below[col] === null && below[col + 1] === null;
  }

  selectCard(row: number, col: number): void {
    if (this.state.phase !== "PLAYING") return;
    if (!this.isExposed(row, col)) return;

    const card = this.state.pyramid[row]![col]!;

    if (cardOrder(card) === 13) {
      this.state.pyramid[row]![col] = null;
      this.state.selected = null;
      this.state.message = "King removed!";
      this.checkEndConditions();
      return;
    }

    if (this.state.selected === null) {
      this.state.selected = [row, col];
      this.state.message = "Now pick a second card to pair.";
      return;
    }

    if (this.state.selected === "waste") {
      const wasteCard = this.state.waste[this.state.waste.length - 1]!;
      if (cardOrder(card) + cardOrder(wasteCard) === 13) {
        this.state.pyramid[row]![col] = null;
        this.state.waste.pop();
        this.state.selected = null;
        this.state.message = "Pair removed!";
        this.checkEndConditions();
      } else {
        this.state.selected = [row, col];
        this.state.message = "No match. Card selected.";
      }
      return;
    }

    const [selRow, selCol] = this.state.selected;
    if (selRow === row && selCol === col) {
      this.state.selected = null;
      this.state.message =
        "Pair exposed cards that sum to 13. Kings remove alone.";
      return;
    }

    const selCard = this.state.pyramid[selRow]![selCol]!;
    if (cardOrder(selCard) + cardOrder(card) === 13) {
      this.state.pyramid[selRow]![selCol] = null;
      this.state.pyramid[row]![col] = null;
      this.state.selected = null;
      this.state.message = "Pair removed!";
      this.checkEndConditions();
    } else {
      this.state.selected = [row, col];
      this.state.message = "No match. Card selected.";
    }
  }

  selectWaste(): void {
    if (this.state.phase !== "PLAYING") return;
    if (this.state.waste.length === 0) return;

    const wasteCard = this.state.waste[this.state.waste.length - 1]!;

    if (cardOrder(wasteCard) === 13) {
      this.state.waste.pop();
      this.state.selected = null;
      this.state.message = "King removed!";
      this.checkEndConditions();
      return;
    }

    if (this.state.selected === null) {
      this.state.selected = "waste";
      this.state.message = "Now pick a pyramid card to pair.";
      return;
    }

    if (this.state.selected === "waste") {
      this.state.selected = null;
      this.state.message =
        "Pair exposed cards that sum to 13. Kings remove alone.";
      return;
    }

    const [selRow, selCol] = this.state.selected;
    const selCard = this.state.pyramid[selRow]![selCol]!;
    if (cardOrder(selCard) + cardOrder(wasteCard) === 13) {
      this.state.pyramid[selRow]![selCol] = null;
      this.state.waste.pop();
      this.state.selected = null;
      this.state.message = "Pair removed!";
      this.checkEndConditions();
    } else {
      this.state.selected = "waste";
      this.state.message = "No match. Waste card selected.";
    }
  }

  drawStock(): void {
    if (this.state.phase !== "PLAYING") return;
    if (this.state.stock.length === 0) return;

    this.state.waste.push(this.state.stock.pop()!);
    this.state.selected = null;
    this.state.message =
      "Pair exposed cards that sum to 13. Kings remove alone.";
    this.checkEndConditions();
  }

  pyramidCardsRemaining(): number {
    let count = 0;
    for (const row of this.state.pyramid) {
      for (const card of row) {
        if (card !== null) count++;
      }
    }
    return count;
  }

  hasAnyMove(): boolean {
    if (this.state.stock.length > 0) return true;

    const exposed: PlayingCard[] = [];
    for (let row = 0; row < this.state.pyramid.length; row++) {
      for (let col = 0; col < this.state.pyramid[row]!.length; col++) {
        if (this.isExposed(row, col)) {
          exposed.push(this.state.pyramid[row]![col]!);
        }
      }
    }

    if (this.state.waste.length > 0) {
      exposed.push(this.state.waste[this.state.waste.length - 1]!);
    }

    for (const c of exposed) {
      if (cardOrder(c) === 13) return true;
    }

    for (let i = 0; i < exposed.length; i++) {
      for (let j = i + 1; j < exposed.length; j++) {
        if (cardOrder(exposed[i]!) + cardOrder(exposed[j]!) === 13) return true;
      }
    }

    return false;
  }

  private checkEndConditions(): void {
    if (this.pyramidCardsRemaining() === 0) {
      this.state.won = true;
      this.state.phase = "GAME_OVER";
      this.state.message = "You cleared the pyramid! You win!";
      return;
    }
    if (!this.hasAnyMove()) {
      this.state.won = false;
      this.state.phase = "GAME_OVER";
      this.state.message = `No moves left. ${this.pyramidCardsRemaining()} cards remaining.`;
    }
  }
}
