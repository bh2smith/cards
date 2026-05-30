import { CardName, Suit, type PlayingCard } from "typedeck";
import { cardOrder, isRed } from "../../shared/deck";
import { dealColumns, MIN_DEAL, MAX_DEAL } from "./deal";
import { type FreecellState, FREE_CELLS } from "./types";

const FOUNDATION_SUITS = [Suit.Clubs, Suit.Spades, Suit.Diamonds, Suit.Hearts];

interface Snapshot {
  tableau: PlayingCard[][];
  freeCells: (PlayingCard | null)[];
  foundations: PlayingCard[][];
  moves: number;
}

export class FreecellGame {
  private state: FreecellState;
  private history: Snapshot[] = [];

  constructor(dealNumber?: number) {
    this.state = this.initialState();
    this.deal(dealNumber ?? this.randomDeal());
  }

  private initialState(): FreecellState {
    return {
      phase: "PLAYING",
      tableau: [],
      freeCells: Array(FREE_CELLS).fill(null),
      foundations: [[], [], [], []],
      selected: null,
      won: false,
      moves: 0,
      dealNumber: 0,
      message: "",
      winner: null,
    };
  }

  getState(): Readonly<FreecellState> {
    return this.state;
  }

  private randomDeal(): number {
    return MIN_DEAL + Math.floor(Math.random() * (MAX_DEAL - MIN_DEAL + 1));
  }

  deal(dealNumber: number): void {
    this.history = [];
    this.state = {
      ...this.initialState(),
      tableau: dealColumns(dealNumber),
      dealNumber,
      message: `Deal #${dealNumber}. Build the foundations Ace → King by suit.`,
    };
  }

  newDeal(): void {
    this.deal(this.randomDeal());
  }

  restart(): void {
    this.deal(this.state.dealNumber);
  }

  // ─── Selection / click handling ───

  selectTableau(col: number, cardIndex: number): void {
    if (this.state.phase !== "PLAYING") return;
    const column = this.state.tableau[col];
    if (!column || cardIndex < 0 || cardIndex >= column.length) return;

    const sel = this.state.selected;
    if (
      sel?.type === "tableau" &&
      sel.col === col &&
      sel.cardIndex === cardIndex
    ) {
      this.clearSelection();
      return;
    }

    if (sel !== null) {
      if (sel.type === "free") {
        if (this.playFreeToTableau(sel.cell, col)) return;
      } else if (sel.type === "tableau") {
        if (this.moveTableauToTableau(sel.col, sel.cardIndex, col)) return;
      }
    }

    // Select this card (and the run beneath it) only if it forms a valid run.
    if (this.isValidRun(column.slice(cardIndex))) {
      this.state.selected = { type: "tableau", col, cardIndex };
      this.state.message = "Select a destination.";
    } else {
      this.state.message = "Not a movable sequence.";
    }
  }

  selectFreeCell(cell: number): void {
    if (this.state.phase !== "PLAYING") return;
    if (cell < 0 || cell >= FREE_CELLS) return;

    const sel = this.state.selected;
    if (sel?.type === "free" && sel.cell === cell) {
      this.clearSelection();
      return;
    }

    if (sel !== null && this.moveSelectionToFreeCell(cell)) return;

    if (this.state.freeCells[cell] !== null) {
      this.state.selected = { type: "free", cell };
      this.state.message = "Select a destination.";
    }
  }

  selectFoundation(suitIndex: number): void {
    if (this.state.phase !== "PLAYING") return;
    if (this.state.selected === null) return;
    this.moveSelectionToFoundation(suitIndex);
  }

  // ─── Moves (each: validate, snapshot, mutate, finalize) ───

  moveTableauToTableau(
    fromCol: number,
    cardIndex: number,
    toCol: number,
  ): boolean {
    if (this.state.phase !== "PLAYING" || fromCol === toCol) return false;
    const from = this.state.tableau[fromCol];
    const to = this.state.tableau[toCol];
    if (!from || !to || cardIndex < 0 || cardIndex >= from.length) return false;

    const run = from.slice(cardIndex);
    if (!this.isValidRun(run)) return false;
    if (!this.canPlaceOnTableau(run[0]!, toCol)) return false;
    if (run.length > this.maxSupermove(to.length === 0)) return false;

    this.snapshot();
    from.splice(cardIndex);
    to.push(...run);
    this.finishMove();
    return true;
  }

  playFreeToTableau(cell: number, toCol: number): boolean {
    if (this.state.phase !== "PLAYING") return false;
    const card = this.state.freeCells[cell];
    if (!card || !this.canPlaceOnTableau(card, toCol)) return false;

    this.snapshot();
    this.state.freeCells[cell] = null;
    this.state.tableau[toCol]!.push(card);
    this.finishMove();
    return true;
  }

  private moveSelectionToFreeCell(cell: number): boolean {
    if (this.state.freeCells[cell] !== null) return false;
    const sel = this.state.selected;
    if (sel === null) return false;

    if (sel.type === "tableau") {
      const col = this.state.tableau[sel.col]!;
      if (sel.cardIndex !== col.length - 1) return false; // free cells take one card
      this.snapshot();
      this.state.freeCells[cell] = col.pop()!;
    } else {
      if (sel.cell === cell) return false;
      const card = this.state.freeCells[sel.cell];
      if (card === null) return false;
      this.snapshot();
      this.state.freeCells[sel.cell] = null;
      this.state.freeCells[cell] = card;
    }
    this.finishMove();
    return true;
  }

  private moveSelectionToFoundation(suitIndex: number): boolean {
    const sel = this.state.selected;
    if (sel === null) return false;

    if (sel.type === "tableau") {
      const col = this.state.tableau[sel.col]!;
      if (sel.cardIndex !== col.length - 1) return false; // only a single card
      const card = col[col.length - 1]!;
      if (!this.canPlaceOnFoundation(card, suitIndex)) return false;
      this.snapshot();
      this.state.foundations[suitIndex]!.push(col.pop()!);
    } else {
      const card = this.state.freeCells[sel.cell];
      if (!card || !this.canPlaceOnFoundation(card, suitIndex)) return false;
      this.snapshot();
      this.state.foundations[suitIndex]!.push(card);
      this.state.freeCells[sel.cell] = null;
    }
    this.finishMove();
    return true;
  }

  // ─── Undo / give up ───

  undo(): void {
    if (this.state.phase !== "PLAYING") return;
    const snap = this.history.pop();
    if (!snap) return;
    this.state.tableau = snap.tableau;
    this.state.freeCells = snap.freeCells;
    this.state.foundations = snap.foundations;
    this.state.moves = snap.moves;
    this.state.selected = null;
    this.state.message = "Move undone.";
  }

  canUndo(): boolean {
    return this.state.phase === "PLAYING" && this.history.length > 0;
  }

  giveUp(): void {
    if (this.state.phase !== "PLAYING") return;
    this.state.phase = "GAME_OVER";
    this.state.won = false;
    this.state.selected = null;
    this.state.message = `Gave up deal #${this.state.dealNumber}. ${this.foundationCount()}/52 placed in ${this.state.moves} moves.`;
  }

  // ─── Auto-complete ───

  canAutoFoundation(card: PlayingCard): number {
    for (let i = 0; i < 4; i++) {
      if (this.canPlaceOnFoundation(card, i)) return i;
    }
    return -1;
  }

  /** True when every remaining card can be sent to a foundation with no other moves. */
  canAutoComplete(): boolean {
    if (this.state.phase !== "PLAYING") return false;
    if (this.foundationCount() === 52) return false;

    const cols = this.state.tableau.map((c) => [...c]);
    const cells = [...this.state.freeCells];
    const tops = this.state.foundations.map((p) =>
      p.length ? cardOrder(p[p.length - 1]!) : 0,
    );
    const indexFor = (card: PlayingCard): number => {
      for (let i = 0; i < 4; i++) {
        if (
          FOUNDATION_SUITS[i] === card.suit &&
          tops[i] === cardOrder(card) - 1
        )
          return i;
      }
      return -1;
    };

    let placed = this.foundationCount();
    let moved = true;
    while (moved) {
      moved = false;
      for (const col of cols) {
        const card = col[col.length - 1];
        if (!card) continue;
        const idx = indexFor(card);
        if (idx >= 0) {
          tops[idx]!++;
          col.pop();
          placed++;
          moved = true;
        }
      }
      for (let i = 0; i < cells.length; i++) {
        const card = cells[i];
        if (!card) continue;
        const idx = indexFor(card);
        if (idx >= 0) {
          tops[idx]!++;
          cells[i] = null;
          placed++;
          moved = true;
        }
      }
    }
    return placed === 52;
  }

  /** Perform one greedy foundation move; returns false when none remain. */
  autoCompleteStep(): boolean {
    if (this.state.phase !== "PLAYING") return false;

    for (let c = 0; c < this.state.tableau.length; c++) {
      const col = this.state.tableau[c]!;
      const card = col[col.length - 1];
      if (!card) continue;
      const idx = this.canAutoFoundation(card);
      if (idx >= 0) {
        this.state.selected = {
          type: "tableau",
          col: c,
          cardIndex: col.length - 1,
        };
        this.moveSelectionToFoundation(idx);
        return true;
      }
    }
    for (let f = 0; f < FREE_CELLS; f++) {
      const card = this.state.freeCells[f];
      if (!card) continue;
      const idx = this.canAutoFoundation(card);
      if (idx >= 0) {
        this.state.selected = { type: "free", cell: f };
        this.moveSelectionToFoundation(idx);
        return true;
      }
    }
    return false;
  }

  // ─── Queries ───

  foundationCount(): number {
    return this.state.foundations.reduce((sum, pile) => sum + pile.length, 0);
  }

  /** Largest run length that can be moved onto a column right now. */
  maxSupermove(toColIsEmpty: boolean): number {
    const freeCount = this.state.freeCells.filter((c) => c === null).length;
    const emptyCols = this.state.tableau.filter((c) => c.length === 0).length;
    const usableEmpty = toColIsEmpty ? Math.max(0, emptyCols - 1) : emptyCols;
    return (freeCount + 1) * 2 ** usableEmpty;
  }

  isValidRun(cards: readonly PlayingCard[]): boolean {
    for (let i = 1; i < cards.length; i++) {
      const prev = cards[i - 1]!;
      const cur = cards[i]!;
      if (isRed(prev) === isRed(cur)) return false;
      if (cardOrder(prev) - cardOrder(cur) !== 1) return false;
    }
    return true;
  }

  private canPlaceOnTableau(card: PlayingCard, colIndex: number): boolean {
    const col = this.state.tableau[colIndex];
    if (!col) return false;
    if (col.length === 0) return true; // empty column accepts anything
    const top = col[col.length - 1]!;
    return isRed(card) !== isRed(top) && cardOrder(top) - cardOrder(card) === 1;
  }

  private canPlaceOnFoundation(card: PlayingCard, suitIndex: number): boolean {
    if (FOUNDATION_SUITS[suitIndex] !== card.suit) return false;
    const pile = this.state.foundations[suitIndex]!;
    if (pile.length === 0) return card.cardName === CardName.Ace;
    return cardOrder(card) - cardOrder(pile[pile.length - 1]!) === 1;
  }

  // ─── Internal ───

  private clearSelection(): void {
    this.state.selected = null;
    this.state.message = "Build the foundations Ace → King by suit.";
  }

  private snapshot(): void {
    this.history.push({
      tableau: this.state.tableau.map((c) => [...c]),
      freeCells: [...this.state.freeCells],
      foundations: this.state.foundations.map((p) => [...p]),
      moves: this.state.moves,
    });
  }

  private finishMove(): void {
    this.state.moves++;
    this.state.selected = null;
    if (this.foundationCount() === 52) {
      this.state.won = true;
      this.state.phase = "GAME_OVER";
      this.state.message = `You win deal #${this.state.dealNumber} in ${this.state.moves} moves!`;
    } else {
      this.state.message = "Build the foundations Ace → King by suit.";
    }
  }
}
