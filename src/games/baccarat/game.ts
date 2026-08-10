import type { PlayingCard } from "typedeck";
import { createDeck, randomSeed, seededRng, shuffle } from "../../shared/deck";
import {
  balance,
  placeWager,
  pushReturn,
  winReturn,
  type Wager,
} from "../../shared/engine/betting";
import { resolvePreset } from "../../shared/engine/variant";
import { BACCARAT_FAMILY, type BaccaratConfig } from "./config";
import {
  bankerDraws,
  cardValue,
  handTotal,
  isNatural,
  playerDraws,
} from "./tableau";
import {
  SEAT_NAMES,
  type BaccaratBet,
  type BaccaratState,
  type CoupOutcome,
} from "./types";

export class BaccaratGame {
  private state: BaccaratState;
  private readonly cfg: BaccaratConfig;
  private readonly rng: () => number;
  private shoe: PlayingCard[] = [];
  private puntoWagers: Wager[] = [];
  private bankerWager: Wager | null = null;
  private punterWager: Wager | null = null;
  private fixedShoe = false;

  constructor(presetId?: string, seed?: number) {
    this.cfg = resolvePreset(BACCARAT_FAMILY, presetId);
    this.rng = seededRng(seed ?? randomSeed());
    this.shoe = this.buildShoe();
    this.state = {
      phase: "BETTING",
      mode: this.cfg.mode,
      shoeCount: this.shoe.length,
      playerCards: [],
      bankerCards: [],
      bets: [],
      result: null,
      lastNet: 0,
      botPurses: [this.cfg.botPurse, this.cfg.botPurse],
      bankerSeat: 0,
      punterSeat: 1,
      bankStake: 0,
      coupAmount: 0,
      bankerCoups: 0,
      bankWillPass: false,
      message: "Place your bets.",
      winner: null,
    };
    if (this.cfg.mode === "chemin-de-fer") this.enterBettingChemin();
  }

  getState(): Readonly<BaccaratState> {
    return this.state;
  }

  getConfig(): Readonly<BaccaratConfig> {
    return this.cfg;
  }

  /** Punto banco: stake one or more side bets for the coming coup. */
  placeBets(bets: BaccaratBet[]): boolean {
    const s = this.state;
    if (s.phase !== "BETTING" || s.mode !== "punto-banco") return false;
    if (s.bets.length > 0) return false;
    const valid = bets.filter((b) => b.amount > 0);
    if (valid.length === 0) return false;
    const total = valid.reduce((sum, b) => sum + b.amount, 0);
    if (total > balance()) return false;
    for (const bet of valid) this.puntoWagers.push(placeWager(bet.amount)!);
    s.bets = valid;
    s.message = "Bets down — deal the coup.";
    return true;
  }

  /** Chemin de Fer: the human banker puts up the bank's stake. */
  stakeBank(amount: number): boolean {
    const s = this.state;
    if (s.phase !== "BETTING" || s.mode !== "chemin-de-fer") return false;
    if (s.bankerSeat !== 0 || s.bankStake > 0) return false;
    const wager = placeWager(amount);
    if (!wager) return false;
    this.bankerWager = wager;
    s.bankStake = amount;
    s.message = `You bank ${amount}. ${SEAT_NAMES[s.punterSeat]} plays the coup.`;
    return true;
  }

  canDeal(): boolean {
    const s = this.state;
    if (s.phase !== "BETTING") return false;
    if (s.mode === "punto-banco") return s.bets.length > 0;
    // A broke human banker deals a free coup rather than blocking the table.
    return s.bankerSeat !== 0 || s.bankStake > 0 || balance() === 0;
  }

  deal(): boolean {
    if (!this.canDeal()) return false;
    const s = this.state;
    if (!this.fixedShoe && this.shoe.length < this.cfg.reshuffleBelow) {
      this.shoe = this.buildShoe();
      s.shoeCount = this.shoe.length;
    }
    if (s.mode === "chemin-de-fer") this.placeCheminStakes();
    const p1 = this.draw();
    const b1 = this.draw();
    const p2 = this.draw();
    const b2 = this.draw();
    s.playerCards = [p1, p2];
    s.bankerCards = [b1, b2];
    if (isNatural(s.playerCards) || isNatural(s.bankerCards)) {
      this.finishCoup(null, true);
      return true;
    }
    const playerTotal = handTotal(s.playerCards);
    if (s.mode === "punto-banco") {
      this.finishCoup(playerDraws(playerTotal) ? this.draw() : null, false);
    } else if (playerTotal <= 4) {
      this.finishCoup(this.draw(), false);
    } else if (playerTotal >= 6) {
      this.finishCoup(null, false);
    } else if (s.punterSeat === 0) {
      s.phase = "PUNTER_DECISION";
      s.message = "Five — the punter's one choice. Draw or stand?";
    } else {
      this.finishCoup(this.rng() < 0.5 ? this.draw() : null, false);
    }
    return true;
  }

  /** Chemin de Fer: the human punter draws on a two-card five. */
  punterDraw(): void {
    if (this.state.phase !== "PUNTER_DECISION") return;
    this.finishCoup(this.draw(), false);
  }

  /** Chemin de Fer: the human punter stands on a two-card five. */
  punterStand(): void {
    if (this.state.phase !== "PUNTER_DECISION") return;
    this.finishCoup(null, false);
  }

  /** Chemin de Fer: the winning human banker gardes (keeps the bank). */
  bankerKeep(): void {
    const s = this.state;
    if (s.phase !== "BANKER_DECISION") return;
    s.bankWillPass = false;
    s.phase = "COUP_OVER";
    s.message = "You garde — the bank stays with you.";
  }

  /** Chemin de Fer: the winning human banker passes the bank on. */
  bankerPass(): void {
    const s = this.state;
    if (s.phase !== "BANKER_DECISION") return;
    s.bankWillPass = true;
    s.phase = "COUP_OVER";
    s.message = "You pass the bank.";
  }

  nextCoup(): void {
    const s = this.state;
    if (s.phase !== "COUP_OVER") return;
    if (s.mode === "punto-banco") {
      s.playerCards = [];
      s.bankerCards = [];
      s.bets = [];
      s.result = null;
      s.winner = null;
      s.lastNet = 0;
      s.phase = "BETTING";
      s.message = "Place your bets.";
      return;
    }
    if (s.bankWillPass) {
      s.bankerSeat = (s.bankerSeat + 1) % 3;
      s.bankerCoups = 0;
    }
    this.advancePunter();
    this.enterBettingChemin();
  }

  /** Test hook: stack the shoe so cards[0] deals first; disables reshuffle. */
  setShoeForTests(cards: PlayingCard[]): void {
    this.shoe = [...cards].reverse();
    this.fixedShoe = true;
    this.state.shoeCount = this.shoe.length;
  }

  /** Test hook: force the Chemin de Fer seating before a coup. */
  setSeatsForTests(bankerSeat: number, punterSeat: number): void {
    const s = this.state;
    if (s.mode !== "chemin-de-fer" || s.phase !== "BETTING") return;
    s.bankerSeat = bankerSeat;
    s.punterSeat = punterSeat;
    this.enterBettingChemin();
  }

  private enterBettingChemin(): void {
    const s = this.state;
    s.playerCards = [];
    s.bankerCards = [];
    s.result = null;
    s.winner = null;
    s.lastNet = 0;
    s.bankStake = 0;
    s.coupAmount = 0;
    s.bankWillPass = false;
    s.phase = "BETTING";
    if (s.bankerSeat === 0) {
      s.message =
        balance() > 0
          ? "You hold the bank — set your stake."
          : "You hold the bank but are out of chips — deal a free coup.";
      return;
    }
    const purse = s.botPurses[s.bankerSeat - 1]!;
    s.bankStake = [25, 10, 5].find((o) => o <= purse) ?? Math.max(purse, 0);
    const punter =
      s.punterSeat === 0
        ? "You play the coup."
        : `${SEAT_NAMES[s.punterSeat]} plays the coup.`;
    s.message = `${SEAT_NAMES[s.bankerSeat]} banks ${s.bankStake}. ${punter}`;
  }

  private placeCheminStakes(): void {
    const s = this.state;
    if (s.punterSeat === 0) {
      s.coupAmount = Math.min(s.bankStake, balance());
      if (s.coupAmount > 0) this.punterWager = placeWager(s.coupAmount);
    } else {
      s.coupAmount = Math.min(s.bankStake, s.botPurses[s.punterSeat - 1]!);
    }
  }

  private finishCoup(punterThird: PlayingCard | null, natural: boolean): void {
    const s = this.state;
    if (punterThird !== null) s.playerCards.push(punterThird);
    if (!natural) {
      const bankerTotal = handTotal(s.bankerCards);
      const thirdValue = punterThird !== null ? cardValue(punterThird) : null;
      if (bankerDraws(bankerTotal, thirdValue)) s.bankerCards.push(this.draw());
    }
    const playerTotal = handTotal(s.playerCards);
    const bankerTotal = handTotal(s.bankerCards);
    const outcome: CoupOutcome =
      playerTotal > bankerTotal
        ? "player"
        : bankerTotal > playerTotal
          ? "banker"
          : "tie";
    s.result = { outcome, natural, playerTotal, bankerTotal };
    if (s.mode === "punto-banco") {
      this.settlePunto(outcome, playerTotal, bankerTotal, natural);
    } else {
      this.settleChemin(outcome, playerTotal, bankerTotal);
    }
  }

  private settlePunto(
    outcome: CoupOutcome,
    playerTotal: number,
    bankerTotal: number,
    natural: boolean,
  ): void {
    const s = this.state;
    let net = 0;
    this.puntoWagers.forEach((wager, i) => {
      const bet = s.bets[i]!;
      let returned = 0;
      if (bet.on === outcome) {
        const mult = outcome === "banker" ? 0.95 : outcome === "tie" ? 8 : 1;
        returned = winReturn(wager.amount, mult);
      } else if (outcome === "tie") {
        // Player and Banker bets push on a tie.
        returned = pushReturn(wager.amount);
      }
      net += returned - wager.amount;
      wager.settle(returned);
    });
    this.puntoWagers = [];
    s.lastNet = net;
    s.winner = net > 0 ? "player" : net < 0 ? "computer" : null;
    const desc =
      outcome === "player"
        ? `Player wins ${playerTotal} to ${bankerTotal}`
        : outcome === "banker"
          ? `Banker wins ${bankerTotal} to ${playerTotal}`
          : `Égalité at ${playerTotal}`;
    const netNote =
      net > 0 ? ` You win ${net}.` : net < 0 ? ` You lose ${-net}.` : " Push.";
    s.message = `${desc}${natural ? " — natural" : ""}.${netNote}`;
    s.phase = "COUP_OVER";
  }

  // Simplification: chemin coups settle at even money with no banker
  // commission; a tie annuls the coup and the banker keeps the bank.
  private settleChemin(
    outcome: CoupOutcome,
    playerTotal: number,
    bankerTotal: number,
  ): void {
    const s = this.state;
    const coup = s.coupAmount;
    let net = 0;
    if (outcome === "tie") {
      this.bankerWager?.settle(pushReturn(this.bankerWager.amount));
      this.punterWager?.settle(pushReturn(this.punterWager.amount));
      const keeps = s.bankerSeat === 0 ? "keep" : "keeps";
      s.message = `Égalité at ${playerTotal}. Coup annulled — ${SEAT_NAMES[s.bankerSeat]} ${keeps} the bank.`;
      s.phase = "COUP_OVER";
    } else if (outcome === "banker") {
      if (s.bankerSeat === 0) {
        this.bankerWager?.settle(s.bankStake + coup);
        net = coup;
      } else {
        s.botPurses[s.bankerSeat - 1]! += coup;
      }
      if (s.punterSeat === 0) {
        this.punterWager?.settle(0);
        net = -coup;
      } else {
        s.botPurses[s.punterSeat - 1]! -= coup;
      }
      s.bankerCoups += 1;
      if (s.bankerSeat === 0) {
        s.phase = "BANKER_DECISION";
        s.message = `Banker wins ${bankerTotal} to ${playerTotal}. You take ${coup}. Garde — keep the bank?`;
      } else {
        s.bankWillPass = s.bankerCoups >= this.cfg.botGardeMax;
        s.phase = "COUP_OVER";
        s.message = `Banker wins ${bankerTotal} to ${playerTotal}. ${SEAT_NAMES[s.bankerSeat]} takes ${coup}${
          s.bankWillPass ? " and passes the bank" : " and gardes"
        }.`;
      }
    } else {
      if (s.bankerSeat === 0) {
        this.bankerWager?.settle(s.bankStake - coup);
        net = -coup;
      } else {
        s.botPurses[s.bankerSeat - 1]! -= coup;
      }
      if (s.punterSeat === 0) {
        this.punterWager?.settle(winReturn(coup, 1));
        net = coup;
      } else {
        s.botPurses[s.punterSeat - 1]! += coup;
      }
      s.bankWillPass = true;
      s.phase = "COUP_OVER";
      const taker =
        s.punterSeat === 0
          ? `You take ${coup}`
          : `${SEAT_NAMES[s.punterSeat]} takes ${coup}`;
      s.message = `Player wins ${playerTotal} to ${bankerTotal}. ${taker} — the bank passes.`;
    }
    this.bankerWager = null;
    this.punterWager = null;
    s.lastNet = net;
    s.winner = net > 0 ? "player" : net < 0 ? "computer" : null;
  }

  private advancePunter(): void {
    const s = this.state;
    do {
      s.punterSeat = (s.punterSeat + 1) % 3;
    } while (s.punterSeat === s.bankerSeat);
  }

  private buildShoe(): PlayingCard[] {
    const cards: PlayingCard[] = [];
    for (let d = 0; d < this.cfg.decks; d++) cards.push(...createDeck());
    return shuffle(cards, this.rng);
  }

  private draw(): PlayingCard {
    const card = this.shoe.pop();
    if (!card) throw new Error("Shoe exhausted");
    this.state.shoeCount = this.shoe.length;
    return card;
  }
}
