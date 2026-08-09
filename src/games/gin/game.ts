import { Suit, type PlayingCard } from "typedeck";
import type { Player } from "../../shared/types";
import { createDeck, shuffle, cardKey } from "../../shared/deck";
import type { RunOptions } from "../../shared/engine/melds";
import { resolvePreset } from "../../shared/engine/variant";
import { findBestMelds, deadwoodValue, findLayoffs, canKnock } from "./melds";
import { botChooseDraw, botChooseDiscard, botShouldKnock } from "./ai";
import {
  GIN_FAMILY,
  ginRunOptions,
  resolveKnockThreshold,
  type GinConfig,
} from "./config";
import { type GinState, type HollywoodState, sortHand } from "./types";

export class GinRummyGame {
  private state: GinState;
  private readonly config: GinConfig;
  private readonly runOptions: RunOptions;

  constructor(presetId?: string) {
    this.config = resolvePreset(GIN_FAMILY, presetId);
    this.runOptions = ginRunOptions(this.config);
    this.state = this.initialState();
    this.deal();
  }

  getConfig(): Readonly<GinConfig> {
    return this.config;
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
      initialUpcard: null,
      knockThreshold:
        typeof this.config.knockThreshold === "number"
          ? this.config.knockThreshold
          : 0,
      knockResult: null,
      hollywood: this.config.hollywood ? emptyHollywood() : null,
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
      initialUpcard: firstDiscard,
      knockThreshold: resolveKnockThreshold(this.config, firstDiscard),
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

    if (
      !canKnock(
        this.state.playerHand,
        this.state.knockThreshold,
        this.runOptions,
      )
    ) {
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
      if (canKnock(remaining, this.state.knockThreshold, this.runOptions))
        return true;
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
      ? botChooseDraw(this.state.computerHand, discardTop, this.runOptions)
      : "stock";

    if (drewFrom === "discard") {
      this.state.computerHand.push(this.state.discardPile.pop()!);
    } else {
      this.ensureStock();
      this.state.computerHand.push(this.state.stock.pop()!);
    }

    const discardIdx = botChooseDiscard(
      this.state.computerHand,
      this.runOptions,
    );
    const discardedCard = this.state.computerHand.splice(discardIdx, 1)[0]!;

    if (
      botShouldKnock(
        this.state.computerHand,
        this.state.knockThreshold,
        this.runOptions,
      )
    ) {
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

    const knockerResult = findBestMelds(knockerHand, this.runOptions);
    const defenderResult = findBestMelds(defenderHand, this.runOptions);

    const knockerDwValue = deadwoodValue(knockerResult.deadwood);
    const isGin = knockerDwValue === 0;

    const layoffs = isGin
      ? []
      : findLayoffs(
          defenderResult.deadwood,
          knockerResult.melds,
          this.runOptions,
        );
    const layoffKeys = new Set(layoffs.map(cardKey));
    const defenderDeadwood = defenderResult.deadwood.filter(
      (c) => !layoffKeys.has(cardKey(c)),
    );
    const defenderDwValue = deadwoodValue(defenderDeadwood);

    const isUndercut = !isGin && defenderDwValue <= knockerDwValue;
    let roundPoints: number;
    let pointsTo: Player;

    if (isGin) {
      roundPoints = this.config.ginBonus + defenderDwValue;
      pointsTo = knocker;
    } else if (isUndercut) {
      roundPoints =
        this.config.undercutBonus + (knockerDwValue - defenderDwValue);
      pointsTo = knocker === "player" ? "computer" : "player";
    } else {
      roundPoints = defenderDwValue - knockerDwValue;
      pointsTo = knocker;
    }

    if (
      this.config.spadeUpcardDoubles &&
      this.state.initialUpcard?.suit === Suit.Spades
    ) {
      roundPoints *= 2;
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

    const gameOver = this.state.hollywood
      ? this.applyHollywoodScore(pointsTo, roundPoints)
      : this.applySingleScore(pointsTo, roundPoints);

    if (gameOver) {
      this.state.phase = "GAME_OVER";
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

  /** Classic scoring: one running total per side. True when the game ends. */
  private applySingleScore(pointsTo: Player, roundPoints: number): boolean {
    if (pointsTo === "player") {
      this.state.playerScore += roundPoints;
    } else {
      this.state.computerScore += roundPoints;
    }

    const target = this.config.targetScore;
    if (
      this.state.playerScore >= target ||
      this.state.computerScore >= target
    ) {
      this.state.winner =
        this.state.playerScore >= target ? "player" : "computer";
      return true;
    }
    return false;
  }

  /**
   * Hollywood scoring: the winner's Nth round win is entered into every
   * still-open column 1..min(N,3). A column closes when a side reaches the
   * target in it; the match ends when all three columns are closed and the
   * higher aggregate across columns wins.
   */
  private applyHollywoodScore(pointsTo: Player, roundPoints: number): boolean {
    const hw = this.state.hollywood!;
    applyHollywoodWin(hw, pointsTo, roundPoints, this.config.targetScore);

    // Aggregate totals across columns mirror the classic score fields.
    this.state.playerScore = hw.columns.reduce(
      (sum, c) => sum + c.playerScore,
      0,
    );
    this.state.computerScore = hw.columns.reduce(
      (sum, c) => sum + c.computerScore,
      0,
    );

    if (hw.columns.every((c) => c.closed)) {
      if (this.state.playerScore !== this.state.computerScore) {
        this.state.winner =
          this.state.playerScore > this.state.computerScore
            ? "player"
            : "computer";
      } else {
        this.state.winner = pointsTo;
      }
      return true;
    }
    return false;
  }

  private ensureStock(): void {
    if (this.state.stock.length > 0) return;
    if (this.state.discardPile.length <= 1) return;
    const top = this.state.discardPile.pop()!;
    this.state.stock = shuffle(this.state.discardPile);
    this.state.discardPile = [top];
  }
}

/**
 * Enter a round win into the Hollywood columns: the winner's Nth win scores
 * in every still-open column 1..min(N,3); a column closes (and records its
 * winner) when a side reaches the target in it.
 */
export function applyHollywoodWin(
  hw: HollywoodState,
  pointsTo: Player,
  roundPoints: number,
  target: number,
): void {
  const wins = pointsTo === "player" ? ++hw.playerWins : ++hw.computerWins;

  for (let i = 0; i < Math.min(wins, 3); i++) {
    const col = hw.columns[i]!;
    if (col.closed) continue;
    if (pointsTo === "player") col.playerScore += roundPoints;
    else col.computerScore += roundPoints;
    if (col.playerScore >= target || col.computerScore >= target) {
      col.closed = true;
      col.winner = pointsTo;
    }
  }
}

export function emptyHollywood(): HollywoodState {
  const column = () => ({
    playerScore: 0,
    computerScore: 0,
    closed: false,
    winner: null,
  });
  return {
    columns: [column(), column(), column()],
    playerWins: 0,
    computerWins: 0,
  };
}
