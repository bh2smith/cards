import type { PlayingCard } from "typedeck";
import { createDeck, shuffle } from "../../shared/deck";
import type { GolfState } from "./types";

const COLUMNS = 7;
const ROWS = 5;

export class GolfGame {
  private state: GolfState;

  constructor() {
    this.state = this.initialState();
  }

  private initialState(): GolfState {
    return {
      phase: "PLAYING",
      tableau: [],
      stock: [],
      waste: null,
      won: false,
      message: "",
      winner: null,
    };
  }

  getState(): Readonly<GolfState> {
    return this.state;
  }

  deal(): void {
    const deck = shuffle(createDeck());

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
      phase: "PLAYING",
      tableau,
      stock,
      waste,
      won: false,
      message: "Remove cards one rank above or below the waste card.",
      winner: null,
    };
  }
}
