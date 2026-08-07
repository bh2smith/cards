import type { PlayingCard } from "typedeck";
import type { Player } from "../../shared/types";
import {
  createDeck,
  shuffle,
  seededRng,
  cardOrder,
  RANK_DISPLAY,
} from "../../shared/deck";
import type { WarState, WarSetup } from "./types";

const WAR_BURY_COUNT = 3;
const MAX_BATTLES = 2000;

/** Battle rank with aces high: 2..10, J=11, Q=12, K=13, A=14. */
export function warRank(card: PlayingCard): number {
  const order = cardOrder(card);
  return order === 1 ? 14 : order;
}

function rankLabel(card: PlayingCard): string {
  return RANK_DISPLAY[card.cardName]!;
}

export class WarGame {
  private state: WarState;

  constructor(setup: WarSetup = {}) {
    const deck =
      setup.deck ??
      shuffle(
        createDeck(),
        setup.seed === undefined ? undefined : seededRng(setup.seed),
      );
    const split = setup.split ?? Math.floor(deck.length / 2);

    this.state = {
      phase: "READY",
      playerPile: deck.slice(0, split),
      computerPile: deck.slice(split),
      playerBattle: null,
      computerBattle: null,
      table: [],
      playerBuried: 0,
      computerBuried: 0,
      battleCount: 0,
      battleWinner: null,
      message: "Flip to battle — high card takes both.",
      winner: null,
    };
  }

  getState(): Readonly<WarState> {
    return this.state;
  }

  flip(): void {
    const s = this.state;
    if (s.phase === "GAME_OVER") return;
    if (s.phase === "WAR") {
      this.warStep();
      return;
    }
    this.collectSpoils();
    s.playerBattle = s.playerPile.shift()!;
    s.computerBattle = s.computerPile.shift()!;
    this.compare();
  }

  /** Moves the previous battle's cards to the winner's pile bottom. */
  private collectSpoils(): void {
    const s = this.state;
    if (!s.battleWinner) return;
    const captured = [s.playerBattle!, s.computerBattle!, ...s.table];
    const pile = s.battleWinner === "player" ? s.playerPile : s.computerPile;
    pile.push(...captured);
    s.table = [];
    s.playerBattle = null;
    s.computerBattle = null;
    s.playerBuried = 0;
    s.computerBuried = 0;
    s.battleWinner = null;
  }

  private warStep(): void {
    const s = this.state;
    s.table.push(s.playerBattle!, s.computerBattle!);
    s.playerBattle = null;
    s.computerBattle = null;

    const pLen = s.playerPile.length;
    const cLen = s.computerPile.length;
    if (pLen === 0 || cLen === 0) {
      // No war card to flip means immediate loss; both empty ties to the player.
      const winner: Player = pLen === 0 && cLen > 0 ? "computer" : "player";
      const winnerPile = winner === "player" ? s.playerPile : s.computerPile;
      winnerPile.push(...s.table);
      s.table = [];
      s.playerBuried = 0;
      s.computerBuried = 0;
      this.endGame(
        winner,
        winner === "player"
          ? "The computer ran out of war cards. You win!"
          : "You ran out of war cards. Computer wins.",
      );
      return;
    }

    const pBury = Math.min(WAR_BURY_COUNT, pLen - 1);
    const cBury = Math.min(WAR_BURY_COUNT, cLen - 1);
    s.table.push(...s.playerPile.splice(0, pBury));
    s.table.push(...s.computerPile.splice(0, cBury));
    s.playerBuried += pBury;
    s.computerBuried += cBury;

    s.playerBattle = s.playerPile.shift()!;
    s.computerBattle = s.computerPile.shift()!;
    this.compare();
  }

  private compare(): void {
    const s = this.state;
    s.battleCount++;
    const p = s.playerBattle!;
    const c = s.computerBattle!;

    if (warRank(p) === warRank(c)) {
      s.phase = "WAR";
      s.battleWinner = null;
      s.message = `War! Both flipped ${rankLabel(p)}. Flip to bury three and fight on.`;
      this.checkSafetyValve();
      return;
    }

    const winner: Player = warRank(p) > warRank(c) ? "player" : "computer";
    s.battleWinner = winner;
    s.phase = "BATTLE";
    const captured = 2 + s.table.length;
    s.message =
      winner === "player"
        ? `Your ${rankLabel(p)} beats ${rankLabel(c)} — you capture ${captured} cards.`
        : `Computer's ${rankLabel(c)} beats ${rankLabel(p)} — it captures ${captured} cards.`;

    const loserPile = winner === "player" ? s.computerPile : s.playerPile;
    if (loserPile.length === 0) {
      this.collectSpoils();
      this.endGame(
        winner,
        winner === "player"
          ? "You captured every card. You win!"
          : "The computer captured every card. You lose.",
      );
      return;
    }
    this.checkSafetyValve();
  }

  private checkSafetyValve(): void {
    const s = this.state;
    if (s.battleCount < MAX_BATTLES) return;
    this.collectSpoils();
    const winner: Player =
      s.playerPile.length >= s.computerPile.length ? "player" : "computer";
    this.endGame(
      winner,
      `${MAX_BATTLES} battles fought — ${
        winner === "player" ? "you hold" : "the computer holds"
      } the bigger pile and takes the game.`,
    );
  }

  private endGame(winner: Player, message: string): void {
    this.state.phase = "GAME_OVER";
    this.state.winner = winner;
    this.state.message = message;
  }
}
