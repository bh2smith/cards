import type { PlayingCard } from "typedeck";
import type { Player } from "../../shared/types";
import { createDeck, shuffle, cardKey } from "../../shared/deck";
import { findBestMelds, deadwoodValue, findLayoffs, canKnock } from "./melds";
import { botChooseDraw, botChooseDiscard, botShouldKnock } from "./ai";
import {
  type GinState,
  type KnockResult,
  WINNING_SCORE,
  GIN_BONUS,
  UNDERCUT_BONUS,
  sortHand,
} from "./types";

export class GinRummyGame {
  private state: GinState;

  constructor() {
    this.state = this.initialState();
    this.deal();
  }

  private initialState(): GinState {
    return {
      phase: "DRAWING",
      playerScore: 0,
      computerScore: 0,
      dealer: "computer",
      currentTurn: "player",
      playerHand: [],
      computerHand: [],
      stock: [],
      discardPile: [],
      knockResult: null,
      message: "",
      winner: null,
    };
  }

  getState(): Readonly<GinState> {
    return this.state;
  }

  deal(): void {
    const deck = shuffle(createDeck());
    const playerHand = deck.slice(0, 10);
    const computerHand = deck.slice(10, 20);
    const firstDiscard = deck[20]!;
    const stock = deck.slice(21);

    sortHand(playerHand);
    sortHand(computerHand);

    const nonDealer: Player =
      this.state.dealer === "player" ? "computer" : "player";

    this.state = {
      ...this.state,
      phase: nonDealer === "computer" ? "BOT_TURN" : "DRAWING",
      currentTurn: nonDealer,
      playerHand,
      computerHand,
      stock,
      discardPile: [firstDiscard],
      knockResult: null,
      message:
        nonDealer === "player"
          ? "Your turn. Draw from stock or discard pile."
          : "Computer's turn…",
      winner: this.state.winner,
    };
  }

  playerDrawFromStock(): void {
    if (this.state.phase !== "DRAWING" || this.state.currentTurn !== "player")
      return;
    this.ensureStock();
    this.state.playerHand.push(this.state.stock.pop()!);
    sortHand(this.state.playerHand);
    this.state.phase = "DISCARDING";
    this.state.message = "Discard a card, or knock if you can.";
  }

  playerDrawFromDiscard(): void {
    if (this.state.phase !== "DRAWING" || this.state.currentTurn !== "player")
      return;
    if (this.state.discardPile.length === 0) return;
    this.state.playerHand.push(this.state.discardPile.pop()!);
    sortHand(this.state.playerHand);
    this.state.phase = "DISCARDING";
    this.state.message = "Discard a card, or knock if you can.";
  }

  playerDiscard(index: number): void {
    if (
      this.state.phase !== "DISCARDING" ||
      this.state.currentTurn !== "player"
    )
      return;
    if (index < 0 || index >= this.state.playerHand.length) return;

    const card = this.state.playerHand.splice(index, 1)[0]!;
    this.state.discardPile.push(card);
    sortHand(this.state.playerHand);
    this.state.currentTurn = "computer";
    this.state.phase = "BOT_TURN";
    this.state.message = "Computer's turn...";
  }

  playerKnock(discardIndex: number): boolean {
    if (
      this.state.phase !== "DISCARDING" ||
      this.state.currentTurn !== "player"
    )
      return false;
    if (discardIndex < 0 || discardIndex >= this.state.playerHand.length)
      return false;

    const card = this.state.playerHand.splice(discardIndex, 1)[0]!;
    this.state.discardPile.push(card);
    sortHand(this.state.playerHand);

    if (!canKnock(this.state.playerHand)) {
      this.state.playerHand.push(this.state.discardPile.pop()!);
      return false;
    }

    this.resolveKnock("player");
    return true;
  }

  canPlayerKnock(): boolean {
    if (
      this.state.phase !== "DISCARDING" ||
      this.state.currentTurn !== "player"
    )
      return false;
    for (let i = 0; i < this.state.playerHand.length; i++) {
      const remaining = this.state.playerHand.filter((_, j) => j !== i);
      if (canKnock(remaining)) return true;
    }
    return false;
  }

  botTurn(): {
    drewFrom: "stock" | "discard";
    discardedCard: PlayingCard;
    knocked: boolean;
  } {
    if (this.state.phase !== "BOT_TURN") {
      throw new Error("Not bot's turn");
    }

    const discardTop =
      this.state.discardPile[this.state.discardPile.length - 1];
    const drewFrom = discardTop
      ? botChooseDraw(this.state.computerHand, discardTop)
      : "stock";

    if (drewFrom === "discard") {
      this.state.computerHand.push(this.state.discardPile.pop()!);
    } else {
      this.ensureStock();
      this.state.computerHand.push(this.state.stock.pop()!);
    }

    const discardIdx = botChooseDiscard(this.state.computerHand);
    const discardedCard = this.state.computerHand.splice(discardIdx, 1)[0]!;

    if (botShouldKnock(this.state.computerHand)) {
      this.state.discardPile.push(discardedCard);
      sortHand(this.state.computerHand);
      this.resolveKnock("computer");
      return { drewFrom, discardedCard, knocked: true };
    }

    this.state.discardPile.push(discardedCard);
    sortHand(this.state.computerHand);
    this.state.currentTurn = "player";
    this.state.phase = "DRAWING";
    this.state.message = "Your turn. Draw from stock or discard pile.";

    return { drewFrom, discardedCard, knocked: false };
  }

  nextRound(): void {
    this.state.dealer = this.state.dealer === "player" ? "computer" : "player";
    this.deal();
  }

  newGame(): void {
    this.state = this.initialState();
    this.deal();
  }

  private resolveKnock(knocker: Player): void {
    const knockerHand =
      knocker === "player" ? this.state.playerHand : this.state.computerHand;
    const defenderHand =
      knocker === "player" ? this.state.computerHand : this.state.playerHand;

    const knockerResult = findBestMelds(knockerHand);
    const defenderResult = findBestMelds(defenderHand);

    const knockerDwValue = deadwoodValue(knockerResult.deadwood);
    const isGin = knockerDwValue === 0;

    const layoffs = isGin
      ? []
      : findLayoffs(defenderResult.deadwood, knockerResult.melds);
    const layoffKeys = new Set(layoffs.map(cardKey));
    const defenderDeadwood = defenderResult.deadwood.filter(
      (c) => !layoffKeys.has(cardKey(c)),
    );
    const defenderDwValue = deadwoodValue(defenderDeadwood);

    const isUndercut = !isGin && defenderDwValue <= knockerDwValue;
    let roundPoints: number;
    let pointsTo: Player;

    if (isGin) {
      roundPoints = GIN_BONUS + defenderDwValue;
      pointsTo = knocker;
    } else if (isUndercut) {
      roundPoints = UNDERCUT_BONUS + (knockerDwValue - defenderDwValue);
      pointsTo = knocker === "player" ? "computer" : "player";
    } else {
      roundPoints = knockerDwValue - defenderDwValue;
      pointsTo = knocker;
    }

    this.state.knockResult = {
      knocker,
      knockerMelds: knockerResult.melds,
      knockerDeadwood: knockerResult.deadwood,
      knockerDeadwoodValue: knockerDwValue,
      defenderMelds: defenderResult.melds,
      defenderDeadwood,
      defenderDeadwoodValue: defenderDwValue,
      isGin,
      isUndercut,
      roundPoints,
      pointsTo,
    };

    if (pointsTo === "player") {
      this.state.playerScore += roundPoints;
    } else {
      this.state.computerScore += roundPoints;
    }

    if (
      this.state.playerScore >= WINNING_SCORE ||
      this.state.computerScore >= WINNING_SCORE
    ) {
      this.state.phase = "GAME_OVER";
      this.state.winner =
        this.state.playerScore >= WINNING_SCORE ? "player" : "computer";
      this.state.message = `${this.state.winner === "player" ? "You" : "Computer"} win${this.state.winner === "player" ? "" : "s"} the game!`;
    } else {
      this.state.phase = "ROUND_OVER";
      if (this.state.knockResult.isGin) {
        this.state.message = `${knocker === "player" ? "You" : "Computer"} got Gin! +${roundPoints} points.`;
      } else if (this.state.knockResult.isUndercut) {
        this.state.message = `Undercut! ${pointsTo === "player" ? "You" : "Computer"} get${pointsTo === "player" ? "" : "s"} ${roundPoints} points.`;
      } else {
        this.state.message = `${knocker === "player" ? "You" : "Computer"} knock${knocker === "player" ? "" : "s"}. +${roundPoints} points.`;
      }
    }
  }

  private ensureStock(): void {
    if (this.state.stock.length > 0) return;
    if (this.state.discardPile.length <= 1) return;
    const top = this.state.discardPile.pop()!;
    this.state.stock = shuffle(this.state.discardPile);
    this.state.discardPile = [top];
  }
}
