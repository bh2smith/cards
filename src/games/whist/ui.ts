import { Suit, type PlayingCard } from "typedeck";
import { WhistGame } from "./game";
import { WHIST_FAMILY, type WhistMode } from "./config";
import { presetFromHash } from "../../shared/engine/variant";
import { presetChipsHtml } from "../../shared/ui/preset-picker";
import { renderCard } from "../../shared/ui/cards";
import { SUIT_SYMBOL, cardKey } from "../../shared/deck";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";
import {
  type TablePos,
  enterTableMode,
  exitTableMode,
  faceDownFanHtml,
  tableLayoutHtml,
  trickCardHtml,
} from "../../shared/ui/table-layout";
import {
  type PlayerIndex,
  type Trick,
  type WhistState,
  PLAYER_LABELS,
  SUITS,
  suitName,
  teamOf,
} from "./types";

const BOT_DELAY_MS = 600;
const TRICK_HOLD_MS = 1000;

const POS: TablePos[] = ["self", "left", "top", "right"];
const OPPONENTS: PlayerIndex[] = [1, 2, 3];
const RED_SUITS = new Set<Suit>([Suit.Hearts, Suit.Diamonds]);

const MODE_TITLES: Record<WhistMode, string> = {
  whist: "Whist",
  knockout: "Knockout Whist",
  "oh-hell": "Oh Hell",
  norwegian: "Norwegian Whist",
};

const MODE_BLURBS: Record<WhistMode, string> = {
  whist:
    "Partnership trick-taking: the dealer's last card fixes trump. Odd tricks past six score — first side to 7 wins.",
  knockout:
    "One card fewer each hand. Take no tricks and you're out; the trick leader names the next trump. Last player standing wins.",
  "oh-hell":
    "Bid the exact tricks you'll take — the dealer can't make bids add up. Exact bids score 10 plus the bid.",
  norwegian:
    "No trump, ever. Declare grand to hunt tricks or nullo to dodge them. First side to 50 wins.",
};

export class WhistUI {
  private game: WhistGame;
  private destroyed = false;
  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly presetId: string | undefined;
  private holdTrick: Trick | null = null;
  private seenTricks = 0;
  private lastTrickCardKey: string | null = null;

  constructor() {
    this.presetId = presetFromHash(location.hash);
    this.game = new WhistGame(this.presetId);
    const mode = this.game.getConfig().mode;
    const teamed = mode === "whist" || mode === "norwegian";
    enterTableMode();
    document.getElementById("app")!.innerHTML = tableLayoutHtml({
      title: MODE_TITLES[mode],
      labels: {
        self: "You",
        left: "Left",
        top: teamed ? "Partner" : "Top",
        right: "Right",
      },
      teams: teamed ? { self: 0, left: 1, top: 0, right: 1 } : undefined,
    });
    this.bindEvents();
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.botTimer !== null) clearTimeout(this.botTimer);
    this.botTimer = null;
    exitTableMode();
    document.getElementById("app")!.innerHTML = "";
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("whist"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => {
        location.hash = "/";
      }),
    );
    this.$("tt-hand").addEventListener("click", (e) => this.onHandClick(e));
    this.$("tt-actions").addEventListener("click", (e) => this.onAction(e));
    this.$("tt-trick").addEventListener("click", (e) => this.onAction(e));
  }

  private onHandClick(e: Event): void {
    if (this.holdTrick) return;
    const target = (e.target as HTMLElement).closest(".card") as HTMLElement;
    if (!target) return;
    const index = parseInt(target.dataset.index ?? "-1");
    if (index < 0) return;
    if (!this.game.humanPlay(index)) return;
    this.sync();
  }

  private onAction(e: Event): void {
    const btn = (e.target as HTMLElement).closest(
      "button[data-act]",
    ) as HTMLElement | null;
    if (!btn) return;
    switch (btn.dataset.act) {
      case "deal":
      case "next":
        this.game.deal();
        this.seenTricks = 0;
        this.holdTrick = null;
        break;
      case "again":
        this.game.newGame();
        this.seenTricks = 0;
        this.holdTrick = null;
        break;
      case "home":
        location.hash = "/";
        return;
      case "suit":
        this.game.pickTrump(0, parseInt(btn.dataset.suit!) as Suit);
        break;
      case "bid":
        this.game.bid(0, parseInt(btn.dataset.bid!));
        break;
      case "grand":
        this.game.declare(0, "grand");
        break;
      case "nullo":
        this.game.declare(0, "nullo");
        break;
      case "pass":
        this.game.declare(0, "pass");
        break;
    }
    this.sync();
  }

  /** Render after a state change, holding a just-completed trick briefly. */
  private sync(): void {
    const s = this.game.getState();
    const n = s.completedTricks.length;
    if (n > this.seenTricks) {
      this.seenTricks = n;
      this.holdTrick = s.completedTricks[n - 1]!;
      this.render();
      setTimeout(() => {
        if (this.destroyed) return;
        this.holdTrick = null;
        this.render();
        this.pump();
      }, TRICK_HOLD_MS);
      return;
    }
    this.render();
    this.pump();
  }

  private needsBot(): boolean {
    const s = this.game.getState();
    return (
      (s.phase === "DECLARING" ||
        s.phase === "BIDDING" ||
        s.phase === "TRUMP_PICK" ||
        s.phase === "PLAYING") &&
      s.currentTurn !== 0
    );
  }

  private pump(): void {
    if (
      this.destroyed ||
      this.botTimer !== null ||
      this.holdTrick !== null ||
      !this.needsBot()
    )
      return;
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      if (this.destroyed) return;
      this.game.botStep();
      this.sync();
    }, BOT_DELAY_MS);
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();
    this.renderScoreboard(state);
    this.renderSeatHands(state);
    this.renderFeltBadge(state);
    this.renderTrick(state);
    this.renderPlayerHand(state);
    this.renderMessage(state);
    this.renderActions(state);
  }

  private isActiveSeat(state: WhistState, seat: PlayerIndex): boolean {
    return (
      (state.phase === "DECLARING" ||
        state.phase === "BIDDING" ||
        state.phase === "TRUMP_PICK" ||
        state.phase === "PLAYING") &&
      state.currentTurn === seat
    );
  }

  private scoreFor(state: WhistState, seat: PlayerIndex): string {
    switch (state.mode) {
      case "whist":
      case "norwegian":
        return String(state.teamScores[teamOf(seat)]);
      case "knockout":
        return state.eliminated[seat] ? "✕" : String(state.trickCounts[seat]);
      case "oh-hell":
        return String(state.scores[seat]);
    }
  }

  private subFor(state: WhistState, seat: PlayerIndex): string {
    if (state.mode === "knockout") {
      return state.eliminated[seat] ? "out" : "";
    }
    if (state.mode === "oh-hell") {
      const bid = state.bids[seat];
      return bid === null ? "" : `${state.trickCounts[seat]}/${bid}`;
    }
    return "●".repeat(state.trickCounts[seat]!);
  }

  private renderScoreboard(state: WhistState): void {
    for (let i = 0 as PlayerIndex; i < 4; i = (i + 1) as PlayerIndex) {
      const pos = POS[i]!;
      this.$(`tt-score-total-${pos}`).textContent = this.scoreFor(state, i);
      this.$(`tt-score-sub-${pos}`).textContent = this.subFor(state, i);
      const nameEl = document.querySelector(
        `#tt-score-${pos} .tt-score-name`,
      ) as HTMLElement;
      const marks =
        (state.declarer === i ? " ★" : "") + (state.dealer === i ? " (D)" : "");
      nameEl.textContent = PLAYER_LABELS[i] + marks;
      this.$(`tt-score-${pos}`).classList.toggle(
        "tt-active",
        this.isActiveSeat(state, i),
      );
    }
  }

  private renderSeatHands(state: WhistState): void {
    for (const i of OPPONENTS) {
      const pos = POS[i]!;
      this.$(`tt-seathand-${pos}`).innerHTML = faceDownFanHtml(
        state.hands[i]!.length,
      );
      const seat = this.$(`tt-seat-${pos}`);
      seat.classList.toggle("tt-active", this.isActiveSeat(state, i));
      seat.classList.toggle("tt-out", state.eliminated[i] === true);
    }
  }

  private renderFeltBadge(state: WhistState): void {
    const badge = this.$("tt-felt-badge");
    if (state.mode === "norwegian") {
      badge.innerHTML = state.handType
        ? `<div class="whist-trump">${state.handType === "grand" ? "Grand" : "Nullo"} · NT</div>`
        : "";
      return;
    }
    if (state.trump === null) {
      badge.innerHTML = "";
      return;
    }
    const red = RED_SUITS.has(state.trump);
    const turned =
      state.trumpCard !== null
        ? renderCard(state.trumpCard, { small: true })
        : "";
    badge.innerHTML = `
      <div class="whist-trump">
        Trump<span class="whist-suit ${red ? "red" : "black"}">${SUIT_SYMBOL[state.trump]}</span>
        ${turned}
      </div>`;
  }

  private overlayHtml(state: WhistState): string {
    const chips = presetChipsHtml(
      "whist",
      WHIST_FAMILY,
      this.presetId,
      "Whist",
    );
    if (state.phase === "PRE_DEAL") {
      return `
        <div class="whist-overlay">
          ${chips}
          <p class="whist-overlay-note">${MODE_BLURBS[state.mode]}</p>
        </div>`;
    }
    const rows = ([0, 1, 2, 3] as PlayerIndex[])
      .map(
        (i) => `
        <div class="whist-result-row${i === 0 ? " you" : ""}">
          <span>${PLAYER_LABELS[i]}</span><span>${this.scoreFor(state, i)}</span>
        </div>`,
      )
      .join("");
    return `
      <div class="whist-overlay">
        <div class="whist-results">${rows}</div>
        ${chips}
      </div>`;
  }

  private renderTrick(state: WhistState): void {
    const area = this.$("tt-trick");
    if (state.phase === "PRE_DEAL" || state.phase === "GAME_OVER") {
      this.lastTrickCardKey = null;
      area.innerHTML = this.overlayHtml(state);
      return;
    }

    let trick: Trick | null = null;
    if (this.holdTrick) trick = this.holdTrick;
    else if (state.currentTrick && state.currentTrick.plays.length > 0)
      trick = state.currentTrick;

    if (!trick) {
      this.lastTrickCardKey = null;
      area.innerHTML = `<div class="tt-trick-empty"></div>`;
      return;
    }

    const byPlayer: (PlayingCard | null)[] = [null, null, null, null];
    for (const play of trick.plays) byPlayer[play.player] = play.card;

    const newest = trick.plays[trick.plays.length - 1];
    const newestKey = newest ? cardKey(newest.card) : null;
    const animateKey =
      newestKey && newestKey !== this.lastTrickCardKey ? newestKey : null;
    this.lastTrickCardKey = newestKey;

    area.innerHTML = POS.map((pos, idx) => {
      const card = byPlayer[idx];
      if (!card) {
        if (state.eliminated[idx]) return "";
        return trickCardHtml(pos, `<div class="tt-trick-slot"></div>`);
      }
      const playIn = cardKey(card) === animateKey;
      return trickCardHtml(pos, renderCard(card, { small: true }), { playIn });
    }).join("");
  }

  private renderPlayerHand(state: WhistState): void {
    const container = this.$("tt-hand");
    const hand = state.hands[0]!;
    const myPlay = state.phase === "PLAYING" && state.currentTurn === 0;
    const legal = new Set(this.game.legalIndicesFor(0));

    container.innerHTML = hand
      .map((c, idx) =>
        renderCard(c, { index: idx, dimmed: myPlay && !legal.has(idx) }),
      )
      .join("");
    container.style.cursor = myPlay ? "pointer" : "default";
  }

  private renderMessage(state: WhistState): void {
    let msg = state.message;
    if (state.phase === "PLAYING" && state.currentTurn === 0) {
      const lead = state.currentTrick?.plays.length === 0;
      const trump =
        state.trump !== null ? `${suitName(state.trump)} trump` : "no trump";
      msg = `Your turn — ${lead ? "lead" : "play"} a card (${trump}).`;
    } else if (state.mode === "knockout" && state.eliminated[0]) {
      if (state.phase === "PLAYING" || state.phase === "TRUMP_PICK")
        msg = `You're knocked out — the others play on. ${state.message}`;
    }
    this.$("tt-message").textContent = msg;
  }

  private renderActions(state: WhistState): void {
    const actions = this.$("tt-actions");
    if (state.phase === "PRE_DEAL") {
      actions.innerHTML = `<button class="tt-btn" data-act="deal" type="button">Deal</button>`;
      return;
    }
    if (state.phase === "TRUMP_PICK" && state.currentTurn === 0) {
      actions.innerHTML = SUITS.map((s) => {
        const red = RED_SUITS.has(s);
        return `<button class="tt-btn whist-suit-btn ${red ? "red" : "black"}" data-act="suit" data-suit="${s}" type="button">${SUIT_SYMBOL[s]}</button>`;
      }).join("");
      return;
    }
    if (state.phase === "BIDDING" && state.currentTurn === 0) {
      const forbidden = this.game.forbiddenBid();
      const buttons: string[] = [];
      for (let n = 0; n <= state.handSize; n++) {
        const hook = n === forbidden;
        buttons.push(
          `<button class="whist-bid-btn${hook ? " hook" : ""}" data-act="bid" data-bid="${n}" type="button" ${hook ? "disabled" : ""}>${n}</button>`,
        );
      }
      actions.innerHTML = `<div class="whist-bid-row">${buttons.join("")}</div>`;
      return;
    }
    if (state.phase === "DECLARING" && state.currentTurn === 0) {
      actions.innerHTML = `
        <button class="tt-btn" data-act="grand" type="button">Grand</button>
        <button class="tt-btn" data-act="nullo" type="button">Nullo</button>
        <button class="tt-btn whist-btn-ghost" data-act="pass" type="button">Pass</button>`;
      return;
    }
    if (state.phase === "HAND_OVER") {
      actions.innerHTML = `<button class="tt-btn" data-act="next" type="button">Next Hand</button>`;
      return;
    }
    if (state.phase === "GAME_OVER") {
      actions.innerHTML = `
        <button class="tt-btn" data-act="again" type="button">Play Again</button>
        <button class="tt-btn whist-btn-ghost" data-act="home" type="button">Back to Game Room</button>`;
      return;
    }
    actions.innerHTML = "";
  }
}
