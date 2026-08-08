import { type PlayingCard } from "typedeck";
import { MichiganGame } from "./game";
import { MICHIGAN_FAMILY, type MichiganMode } from "./config";
import { presetFromHash } from "../../shared/engine/variant";
import { presetChipsHtml } from "../../shared/ui/preset-picker";
import { getBankroll } from "../../shared/engine/bankroll";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { SUIT_SYMBOL } from "../../shared/deck";
import { openInstructions } from "../../shared/ui/instructions-modal";
import {
  type MichiganState,
  type PlayerIndex,
  PLAYER_LABELS,
  SUITS,
  isRedSuit,
  orderLabel,
} from "./types";

const BOT_DELAY_MS = 550;

const MODE_TITLES: Record<MichiganMode, string> = {
  michigan: "Michigan",
  "fan-tan": "Fan Tan",
  "play-or-pay": "Play or Pay",
};

const MODE_BLURBS: Record<MichiganMode, string> = {
  michigan:
    "Race ascending suit runs to empty your hand. Boodle cards pay chips; the dealer may gamble on the widow.",
  "fan-tan":
    "Build each suit out from its seven. Can't play? Pay a chip. First out takes the pot.",
  "play-or-pay":
    "One shared sequence, round the corner. Play the next card or pay. First out takes the pot.",
};

export class MichiganUI {
  private game: MichiganGame;
  private destroyed = false;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly presetId: string | undefined;

  constructor() {
    this.presetId = presetFromHash(location.hash);
    this.game = new MichiganGame(this.presetId);
    document.getElementById("app")!.innerHTML = this.template();
    this.bindEvents();
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.botTimer !== null) clearTimeout(this.botTimer);
    this.botTimer = null;
    document.getElementById("app")!.innerHTML = "";
  }

  private template(): string {
    const mode = this.game.getConfig().mode;
    return `
      <div id="mich-root">
        <div class="header">
          <div class="header-left">
            <a href="#" class="back-link">← Games</a>
            <h1>${MODE_TITLES[mode]}</h1>
          </div>
          <div class="header-right">
            <button class="help-btn" data-action="help" type="button" aria-label="How to play">?</button>
          </div>
        </div>
        <div class="mich-status" id="mich-status"></div>
        <div class="mich-table">
          <div class="mich-seat mich-seat-top" id="mich-seat-2"></div>
          <div class="mich-seat mich-seat-left" id="mich-seat-1"></div>
          <div class="mich-center" id="mich-center"></div>
          <div class="mich-seat mich-seat-right" id="mich-seat-3"></div>
          <div class="mich-seat mich-seat-self" id="mich-seat-0"></div>
        </div>
        <div class="hand-area mich-hand" id="mich-hand"></div>
        <div class="message-bar" id="mich-message"></div>
        <div class="action-area mich-actions" id="mich-actions"></div>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("mich-root").addEventListener("click", (e) => {
      const el = e.target as HTMLElement;
      const btn = el.closest("button[data-action]") as HTMLElement | null;
      if (btn) {
        this.onAction(btn.dataset.action!);
        return;
      }
      const card = el.closest("#mich-hand .card") as HTMLElement | null;
      if (card) this.onCardClick(card);
    });
  }

  private onAction(action: string): void {
    switch (action) {
      case "help":
        openInstructions("michigan");
        return;
      case "deal":
      case "next-hand":
        this.game.deal();
        break;
      case "swap":
        this.game.dealerSwap(true);
        break;
      case "keep":
        this.game.dealerSwap(false);
        break;
      case "pass":
        this.game.humanPass();
        break;
      case "new-session":
        this.game.newSession();
        break;
    }
    this.render();
    this.pump();
  }

  private onCardClick(cardEl: HTMLElement): void {
    const index = parseInt(cardEl.dataset.index ?? "-1");
    if (index < 0) return;
    if (!this.game.humanPlay(index)) return;
    this.render();
    this.pump();
  }

  private needsBot(): boolean {
    const s = this.game.getState();
    return (
      (s.phase === "AWAIT_LEAD" ||
        s.phase === "AWAIT_PLAY" ||
        s.phase === "AWAIT_FORCED") &&
      s.currentTurn !== 0
    );
  }

  private pump(): void {
    if (this.destroyed || this.botTimer !== null || !this.needsBot()) return;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      if (this.destroyed) return;
      this.game.botStep();
      this.render();
      this.pump();
    }, BOT_DELAY_MS);
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();
    this.renderStatus(state);
    for (let i = 1; i < 4; i++) this.renderSeat(state, i as PlayerIndex);
    this.renderSelfSeat(state);
    this.renderCenter(state);
    this.renderHand(state);
    this.$("mich-message").textContent = state.message;
    this.renderActions(state);
  }

  private renderStatus(state: MichiganState): void {
    const cfg = this.game.getConfig();
    const hand = state.handNumber > 0 ? state.handNumber : "–";
    const pot = state.mode === "michigan" ? "" : ` · Pot: ${state.pot}`;
    this.$("mich-status").innerHTML =
      `Hand ${hand}/${cfg.handsPerGame}${pot} · Bankroll: ${getBankroll()}`;
  }

  private seatActive(state: MichiganState, seat: PlayerIndex): boolean {
    return (
      (state.phase === "AWAIT_LEAD" ||
        state.phase === "AWAIT_PLAY" ||
        state.phase === "AWAIT_FORCED" ||
        state.phase === "DEALER_SWAP") &&
      state.currentTurn === seat
    );
  }

  private renderSeat(state: MichiganState, seat: PlayerIndex): void {
    const el = this.$(`mich-seat-${seat}`);
    const count = state.hands[seat]!.length;
    const fan = Array.from({ length: count }, () =>
      renderFaceDownCard(-1, true),
    ).join("");
    el.innerHTML = `
      <div class="mich-seat-info">
        <span class="mich-seat-name">${PLAYER_LABELS[seat]}${state.dealer === seat ? " ◈" : ""}</span>
        <span class="mich-seat-chips">${state.chips[seat]} chips</span>
      </div>
      <div class="mich-fan">${fan}</div>
    `;
    el.classList.toggle("mich-active", this.seatActive(state, seat));
  }

  private renderSelfSeat(state: MichiganState): void {
    const el = this.$("mich-seat-0");
    el.innerHTML = `
      <div class="mich-seat-info">
        <span class="mich-seat-name">You${state.dealer === 0 ? " ◈" : ""}</span>
        <span class="mich-seat-chips">${state.chips[0]} chips</span>
      </div>
    `;
    el.classList.toggle("mich-active", this.seatActive(state, 0));
  }

  private renderCenter(state: MichiganState): void {
    const center = this.$("mich-center");
    if (state.phase === "PRE_DEAL" || state.phase === "GAME_OVER") {
      center.innerHTML = this.overlayHtml(state);
      return;
    }
    switch (state.mode) {
      case "michigan":
        center.innerHTML = this.michiganCenterHtml(state);
        break;
      case "fan-tan":
        center.innerHTML = this.fanTanCenterHtml(state);
        break;
      case "play-or-pay":
        center.innerHTML = this.playOrPayCenterHtml(state);
        break;
    }
  }

  private overlayHtml(state: MichiganState): string {
    const mode = state.mode;
    const chips = presetChipsHtml(
      "michigan",
      MICHIGAN_FAMILY,
      this.presetId,
      "Michigan",
    );
    if (state.phase === "PRE_DEAL") {
      return `
        <div class="mich-overlay">
          ${chips}
          <p class="mich-overlay-note">${MODE_BLURBS[mode]}</p>
          <button class="mich-btn" data-action="deal" type="button">Deal</button>
        </div>
      `;
    }
    const rows = [0, 1, 2, 3]
      .map(
        (i) =>
          `<div class="mich-result-row${i === 0 ? " you" : ""}">
            <span>${PLAYER_LABELS[i]}</span><span>${state.chips[i]} chips</span>
          </div>`,
      )
      .join("");
    return `
      <div class="mich-overlay">
        <div class="mich-results">${rows}</div>
        ${chips}
        <button class="mich-btn" data-action="new-session" type="button">New Session</button>
      </div>
    `;
  }

  private michiganCenterHtml(state: MichiganState): string {
    const boodle = state.boodle
      .map(
        (b) => `
        <div class="mich-boodle-slot">
          ${renderCard({ cardName: b.cardName, suit: b.suit } as PlayingCard, { small: true })}
          <span class="mich-chip-badge">${b.chips}</span>
        </div>`,
      )
      .join("");
    const run = state.sequence
      ? state.sequence.cards
          .slice(-4)
          .map((c) => renderCard(c, { small: true }))
          .join("")
      : `<div class="mich-run-empty">New run…</div>`;
    return `
      <div class="mich-boodle">${boodle}</div>
      <div class="mich-run">${run}</div>
      <div class="mich-note">Widow: ${state.deadHand.length} cards</div>
    `;
  }

  private fanTanCenterHtml(state: MichiganState): string {
    const rows = SUITS.map((suit) => {
      const row = state.rows[suit]!;
      const span =
        row.low === null
          ? "—"
          : row.low === row.high
            ? orderLabel(row.low)
            : `${orderLabel(row.low)}–${orderLabel(row.high!)}`;
      const red = isRedSuit(suit) ? "red" : "black";
      return `
        <div class="mich-ft-row">
          <span class="mich-ft-suit ${red}">${SUIT_SYMBOL[suit]}</span>
          <span class="mich-ft-span">${span}</span>
        </div>`;
    }).join("");
    return `<div class="mich-ft-rows">${rows}</div>`;
  }

  private playOrPayCenterHtml(state: MichiganState): string {
    const seq = state.sequence;
    const cards = seq
      ? seq.cards
          .slice(-4)
          .map((c) => renderCard(c, { small: true }))
          .join("")
      : `<div class="mich-run-empty">Waiting for a lead…</div>`;
    const need = seq
      ? `<div class="mich-note">Needs ${orderLabel(seq.nextOrder)}${SUIT_SYMBOL[seq.suit]} · ${seq.playedCount}/13</div>`
      : "";
    const done = state.startedSuits
      .filter((s) => !seq || s !== seq.suit)
      .map((s) => SUIT_SYMBOL[s])
      .join(" ");
    return `
      <div class="mich-run">${cards}</div>
      ${need}
      ${done ? `<div class="mich-note">Done: ${done}</div>` : ""}
    `;
  }

  private renderHand(state: MichiganState): void {
    const container = this.$("mich-hand");
    const hand = state.hands[0]!;
    const legal = new Set(this.game.legalIndicesFor(0));
    const acting = this.seatActive(state, 0) && state.phase !== "DEALER_SWAP";

    container.innerHTML = hand
      .map((c, i) => {
        const playable = acting && legal.has(i);
        const html = renderCard(c, { index: i, dimmed: acting && !playable });
        return playable
          ? html.replace('class="card ', 'class="card mich-playable ')
          : html;
      })
      .join("");
    container.style.cursor = acting && legal.size > 0 ? "pointer" : "default";
  }

  private renderActions(state: MichiganState): void {
    const actions = this.$("mich-actions");
    if (state.phase === "DEALER_SWAP" && state.dealer === 0) {
      actions.innerHTML = `
        <button class="mich-btn" data-action="swap" type="button">Swap for Widow</button>
        <button class="mich-btn" data-action="keep" type="button">Keep Hand</button>
      `;
    } else if (this.game.humanMustPass()) {
      actions.innerHTML = `<button class="mich-btn" data-action="pass" type="button">Pay 1 Chip</button>`;
    } else if (state.phase === "HAND_OVER") {
      actions.innerHTML = `<button class="mich-btn" data-action="next-hand" type="button">Next Hand</button>`;
    } else {
      actions.innerHTML = "";
    }
  }
}
