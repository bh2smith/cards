import type { PlayingCard } from "typedeck";
import { BaccaratGame } from "./game";
import { BACCARAT_FAMILY } from "./config";
import { handTotal } from "./tableau";
import { SEAT_NAMES, type BaccaratState, type BetKind } from "./types";
import { presetFromHash } from "../../shared/engine/variant";
import { presetChipsHtml } from "../../shared/ui/preset-picker";
import { balance, betOptions } from "../../shared/engine/betting";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { openInstructions } from "../../shared/ui/instructions-modal";

const REVEAL_MS = 350;

export class BaccaratUI {
  private game: BaccaratGame;
  private destroyed = false;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private revealCount = 0;
  private readonly presetId: string | undefined;
  private chip = 5;
  private pending: Record<BetKind, number> = { player: 0, banker: 0, tie: 0 };

  constructor() {
    this.presetId = presetFromHash(location.hash);
    this.game = new BaccaratGame(this.presetId);
    document.getElementById("app")!.innerHTML = this.template();
    this.bindEvents();
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.revealTimer !== null) clearTimeout(this.revealTimer);
    this.revealTimer = null;
    document.getElementById("app")!.innerHTML = "";
  }

  private template(): string {
    const title =
      this.game.getConfig().mode === "chemin-de-fer"
        ? "Chemin de Fer"
        : "Baccarat";
    return `
      <div id="bacc-root">
        <div class="header">
          <div class="header-left">
            <a href="#" class="back-link">← Games</a>
            <h1>${title}</h1>
          </div>
          <div class="header-right">
            <button class="help-btn" data-action="help" type="button" aria-label="How to play">?</button>
          </div>
        </div>
        <div class="bacc-status" id="bacc-status"></div>
        <div class="bacc-seats" id="bacc-seats"></div>
        <div class="bacc-table">
          <div class="bacc-hand-section">
            <div>Player <span class="bacc-total" id="bacc-player-total"></span></div>
            <div class="bacc-hand" id="bacc-player-hand"></div>
          </div>
          <div class="bacc-hand-section">
            <div>Banker <span class="bacc-total" id="bacc-banker-total"></span></div>
            <div class="bacc-hand" id="bacc-banker-hand"></div>
          </div>
        </div>
        <div class="bacc-banner hidden" id="bacc-banner"></div>
        <div class="message-bar" id="bacc-message"></div>
        <div class="action-area bacc-actions" id="bacc-actions"></div>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("bacc-root").addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest(
        "[data-action],[data-chip],[data-zone],[data-stake]",
      ) as HTMLElement | null;
      if (!el) return;
      if (el.dataset.action) {
        this.onAction(el.dataset.action);
      } else if (el.dataset.chip) {
        this.chip = parseInt(el.dataset.chip);
        this.render();
      } else if (el.dataset.zone) {
        this.onZone(el.dataset.zone as BetKind);
      } else if (el.dataset.stake) {
        if (this.game.stakeBank(parseInt(el.dataset.stake))) this.render();
      }
    });
  }

  private onAction(action: string): void {
    switch (action) {
      case "help":
        openInstructions("baccarat");
        return;
      case "deal":
        this.onDeal();
        return;
      case "clear":
        this.pending = { player: 0, banker: 0, tie: 0 };
        break;
      case "punter-draw":
        this.game.punterDraw();
        break;
      case "punter-stand":
        this.game.punterStand();
        break;
      case "banker-keep":
        this.game.bankerKeep();
        break;
      case "banker-pass":
        this.game.bankerPass();
        break;
      case "next-coup":
        this.revealCount = 0;
        this.game.nextCoup();
        break;
    }
    this.render();
    this.pumpReveal();
  }

  private onDeal(): void {
    const state = this.game.getState();
    if (state.mode === "punto-banco") {
      const bets = (Object.entries(this.pending) as [BetKind, number][])
        .filter(([, amount]) => amount > 0)
        .map(([on, amount]) => ({ on, amount }));
      if (bets.length === 0 || !this.game.placeBets(bets)) return;
      this.pending = { player: 0, banker: 0, tie: 0 };
    }
    this.revealCount = 0;
    if (!this.game.deal()) return;
    this.render();
    this.pumpReveal();
  }

  private onZone(zone: BetKind): void {
    if (this.game.getState().phase !== "BETTING") return;
    const total = this.pending.player + this.pending.banker + this.pending.tie;
    if (this.chip <= 0 || total + this.chip > balance()) return;
    this.pending[zone] += this.chip;
    this.render();
  }

  private totalCards(): number {
    const s = this.game.getState();
    return s.playerCards.length + s.bankerCards.length;
  }

  private pumpReveal(): void {
    if (this.destroyed || this.revealTimer !== null) return;
    if (this.revealCount >= this.totalCards()) return;
    this.revealTimer = setTimeout(() => {
      this.revealTimer = null;
      if (this.destroyed) return;
      this.revealCount++;
      this.render();
      this.pumpReveal();
    }, REVEAL_MS);
  }

  /** How many cards of each hand are face-up, dealing P,B,P,B then thirds. */
  private shownCounts(): { p: number; b: number } {
    const s = this.game.getState();
    const order: ("p" | "b")[] = [];
    for (
      let i = 0;
      i < Math.max(s.playerCards.length, s.bankerCards.length);
      i++
    ) {
      if (i < s.playerCards.length) order.push("p");
      if (i < s.bankerCards.length) order.push("b");
    }
    const shown = order.slice(0, this.revealCount);
    return {
      p: shown.filter((x) => x === "p").length,
      b: shown.filter((x) => x === "b").length,
    };
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();
    const done = this.revealCount >= this.totalCards();
    this.renderStatus(state);
    this.renderSeats(state);
    this.renderHands(state);
    this.renderBanner(state, done);
    this.$("bacc-message").textContent = done ? state.message : "Dealing…";
    this.renderActions(state, done);
  }

  private renderStatus(state: BaccaratState): void {
    const coup =
      state.mode === "chemin-de-fer" && state.coupAmount > 0
        ? ` · Coup: ${state.coupAmount}`
        : "";
    this.$("bacc-status").textContent =
      `Bankroll: ${balance()} · Shoe: ${state.shoeCount} cards${coup}`;
  }

  private renderSeats(state: BaccaratState): void {
    const el = this.$("bacc-seats");
    if (state.mode !== "chemin-de-fer") {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = [0, 1, 2]
      .map((i) => {
        const funds = i === 0 ? balance() : state.botPurses[i - 1]!;
        const bank =
          i === state.bankerSeat
            ? `<span class="bacc-badge bank">BANK${state.bankStake > 0 ? ` ${state.bankStake}` : ""}</span>`
            : "";
        const punter =
          i === state.punterSeat
            ? `<span class="bacc-badge">PUNTER</span>`
            : "";
        const banking = i === state.bankerSeat ? " bacc-banking" : "";
        return `<div class="bacc-seat${banking}">
          <b>${SEAT_NAMES[i]}</b>
          <span>${funds} chips</span>
          ${bank}${punter}
        </div>`;
      })
      .join("");
  }

  private renderHands(state: BaccaratState): void {
    const { p, b } = this.shownCounts();
    const hand = (cards: PlayingCard[], shown: number) =>
      cards
        .map((c, i) => (i < shown ? renderCard(c) : renderFaceDownCard()))
        .join("");
    const total = (cards: PlayingCard[], shown: number) =>
      shown > 0 ? String(handTotal(cards.slice(0, shown))) : "";
    this.$("bacc-player-hand").innerHTML = hand(state.playerCards, p);
    this.$("bacc-banker-hand").innerHTML = hand(state.bankerCards, b);
    this.$("bacc-player-total").textContent = total(state.playerCards, p);
    this.$("bacc-banker-total").textContent = total(state.bankerCards, b);
  }

  private renderBanner(state: BaccaratState, done: boolean): void {
    const el = this.$("bacc-banner");
    if (!done || !state.result) {
      el.classList.add("hidden");
      return;
    }
    const r = state.result;
    const label =
      r.outcome === "tie"
        ? `ÉGALITÉ — ${r.playerTotal} ALL`
        : r.outcome === "player"
          ? `PLAYER WINS ${r.playerTotal}–${r.bankerTotal}`
          : `BANKER WINS ${r.bankerTotal}–${r.playerTotal}`;
    const net =
      state.lastNet > 0
        ? `+${state.lastNet}`
        : state.lastNet < 0
          ? String(state.lastNet)
          : "±0";
    el.textContent = `${label}${r.natural ? " · NATURAL" : ""} · ${net} chips`;
    el.classList.remove("hidden");
  }

  private renderActions(state: BaccaratState, done: boolean): void {
    const el = this.$("bacc-actions");
    if (!done) {
      el.innerHTML = "";
      return;
    }
    switch (state.phase) {
      case "BETTING":
        el.innerHTML =
          state.mode === "punto-banco"
            ? this.puntoBettingHtml()
            : this.cheminBettingHtml(state);
        return;
      case "PUNTER_DECISION":
        el.innerHTML = `<div class="bacc-row">
          <button data-action="punter-draw" type="button">Draw</button>
          <button data-action="punter-stand" type="button">Stand</button>
        </div>`;
        return;
      case "BANKER_DECISION":
        el.innerHTML = `<div class="bacc-row">
          <button data-action="banker-keep" type="button">Keep the Bank</button>
          <button data-action="banker-pass" type="button">Pass the Bank</button>
        </div>`;
        return;
      case "COUP_OVER":
        el.innerHTML = `<button data-action="next-coup" type="button">Next Coup</button>`;
        return;
    }
  }

  private puntoBettingHtml(): string {
    const options = betOptions(balance());
    if (options.length > 0 && !options.includes(this.chip)) {
      this.chip = options[0]!;
    }
    const chips = options
      .map(
        (n) =>
          `<button class="bacc-chip${n === this.chip ? " active" : ""}" data-chip="${n}" type="button">${n}</button>`,
      )
      .join("");
    const zone = (kind: BetKind, label: string, pay: string) =>
      `<button class="bacc-zone" data-zone="${kind}" type="button">
        <b>${label}</b><small>${pay}</small>
        <span class="bacc-zone-amt">${this.pending[kind] > 0 ? this.pending[kind] : ""}</span>
      </button>`;
    const total = this.pending.player + this.pending.banker + this.pending.tie;
    return `
      ${presetChipsHtml("baccarat", BACCARAT_FAMILY, this.presetId, "Punto Banco")}
      <div class="bacc-row">${chips}</div>
      <div class="bacc-row">
        ${zone("player", "Player", "1:1")}
        ${zone("banker", "Banker", "0.95:1")}
        ${zone("tie", "Tie", "8:1")}
      </div>
      <div class="bacc-row">
        <button data-action="clear" type="button"${total === 0 ? " disabled" : ""}>Clear</button>
        <button data-action="deal" type="button"${total === 0 ? " disabled" : ""}>Deal</button>
      </div>
    `;
  }

  private cheminBettingHtml(state: BaccaratState): string {
    const presets = presetChipsHtml(
      "baccarat",
      BACCARAT_FAMILY,
      this.presetId,
      "Punto Banco",
    );
    if (state.bankerSeat === 0 && state.bankStake === 0 && balance() > 0) {
      const stakes = betOptions(balance())
        .map(
          (n) =>
            `<button class="bacc-chip" data-stake="${n}" type="button">${n}</button>`,
        )
        .join("");
      return `${presets}<div class="bacc-row">${stakes}</div>`;
    }
    return `${presets}<button data-action="deal" type="button">Deal</button>`;
  }
}
