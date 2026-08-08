import { RummyGame } from "./game";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import type { RummyState, TableMeld } from "./types";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";
import { presetFromHash } from "../../shared/engine/variant";
import { presetChipsHtml } from "../../shared/ui/preset-picker";
import { RUMMY_FAMILY } from "./config";

export class RummyUI {
  private game: RummyGame;
  private destroyed = false;
  private animating = false;
  private presetId: string | undefined;
  private selected = new Set<number>();

  constructor() {
    this.presetId = presetFromHash(location.hash);
    document.getElementById("app")!.innerHTML = this.template();
    this.game = new RummyGame(this.presetId);
    this.bindEvents();
    this.render();
    if (this.game.getState().phase === "BOT_TURN") this.scheduleBotTurn();
  }

  destroy(): void {
    this.destroyed = true;
    document.getElementById("app")!.innerHTML = "";
  }

  private template(): string {
    const presetName = this.presetId
      ? RUMMY_FAMILY.presets[this.presetId]?.name
      : undefined;
    return `
      <div class="header">
        <div class="header-left">
          <a href="#" class="back-link">← Games</a>
          <h1>${presetName ?? "Straight Rummy"}</h1>
        </div>
        <div class="header-right">
          <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
          <button id="new-game-btn">New Game</button>
        </div>
      </div>

      ${presetChipsHtml("rummy", RUMMY_FAMILY, this.presetId, "Straight Rummy")}

      <div class="scoreboard">
        <div class="score-row">
          <span class="score-label">You</span>
          <span class="score-value" id="player-score">0</span>
        </div>
        <div class="board-track"><div class="board-peg" id="player-peg" style="width:0%"></div></div>
        <div class="score-row">
          <span class="score-label">Computer</span>
          <span class="score-value" id="computer-score">0</span>
        </div>
        <div class="board-track"><div class="board-peg" id="computer-peg" style="width:0%"></div></div>
      </div>

      <div class="hand-area rummy-bot-hand" id="computer-hand"></div>

      <div class="rummy-table hidden" id="rummy-table">
        <div class="rummy-meld-zone">
          <div class="rummy-zone-label">Their melds</div>
          <div class="rummy-melds" id="their-melds"></div>
        </div>
        <div class="rummy-meld-zone">
          <div class="rummy-zone-label">Your melds</div>
          <div class="rummy-melds" id="your-melds"></div>
        </div>
      </div>

      <div class="play-area rummy-play-area">
        <div id="rummy-stock"></div>
        <div id="rummy-discard"></div>
      </div>

      <div class="hand-area rummy-hand" id="player-hand"></div>

      <div id="rummy-knock-summary" class="hidden"></div>

      <div class="message-bar" id="message"></div>

      <div class="action-area">
        <div class="rummy-action-buttons">
          <button id="meld-btn" class="hidden">Meld</button>
          <button id="discard-btn" class="hidden">Discard</button>
          <button id="knock-btn" class="hidden">Knock</button>
          <button id="rummy-btn" class="hidden">Go Rummy</button>
          <button id="action-btn" class="hidden">Next Round</button>
        </div>
      </div>
    `;
  }

  private $(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  private bindEvents(): void {
    this.$("help-btn").addEventListener("click", () =>
      openInstructions("rummy"),
    );
    this.$("new-game-btn").addEventListener("click", () =>
      confirmIfEnabled("Leave this game?", () => {
        location.hash = "/";
      }),
    );
    this.$("rummy-stock").addEventListener("click", () => this.onDrawStock());
    this.$("rummy-discard").addEventListener("click", (e) =>
      this.onDiscardPileClick(e),
    );
    this.$("player-hand").addEventListener("click", (e) => this.onHandClick(e));
    this.$("rummy-table").addEventListener("click", (e) => this.onMeldClick(e));
    this.$("meld-btn").addEventListener("click", () => this.onMeld());
    this.$("discard-btn").addEventListener("click", () => this.onDiscard());
    this.$("knock-btn").addEventListener("click", () => this.onKnock());
    this.$("rummy-btn").addEventListener("click", () => this.onGoRummy());
    this.$("action-btn").addEventListener("click", () => this.onAction());
  }

  private afterAction(): void {
    this.selected.clear();
    this.render();
    if (this.game.getState().phase === "BOT_TURN") this.scheduleBotTurn();
  }

  private onDrawStock(): void {
    if (this.animating) return;
    if (this.game.playerDrawFromStock()) this.afterAction();
  }

  private onDiscardPileClick(e: Event): void {
    if (this.animating) return;
    const cfg = this.game.getConfig();
    let depth: number | undefined;
    if (cfg.discardPickup === "any") {
      const el = (e.target as HTMLElement).closest(".card") as HTMLElement;
      if (!el) return;
      depth = parseInt(el.dataset.depth ?? "-1");
      if (depth < 0) return;
    }
    if (this.game.playerDrawFromDiscard(depth)) this.afterAction();
  }

  private onHandClick(e: Event): void {
    if (this.animating) return;
    const state = this.game.getState();
    if (state.phase !== "PLAYER_MELD") return;
    const el = (e.target as HTMLElement).closest(".card") as HTMLElement;
    if (!el) return;
    const index = parseInt(el.dataset.index ?? "-1");
    if (index < 0) return;
    if (this.selected.has(index)) this.selected.delete(index);
    else this.selected.add(index);
    this.render();
  }

  private onMeldClick(e: Event): void {
    if (this.animating || this.selected.size !== 1) return;
    const el = (e.target as HTMLElement).closest(".rummy-meld") as HTMLElement;
    if (!el) return;
    const meldIndex = parseInt(el.dataset.meldIndex ?? "-1");
    const handIndex = [...this.selected][0]!;
    if (this.game.playerLayOff(handIndex, meldIndex)) this.afterAction();
  }

  private onMeld(): void {
    if (this.animating) return;
    if (this.game.playerMeld([...this.selected])) this.afterAction();
  }

  private onDiscard(): void {
    if (this.animating || this.selected.size !== 1) return;
    if (this.game.playerDiscard([...this.selected][0]!)) this.afterAction();
  }

  private onKnock(): void {
    if (this.animating || this.selected.size !== 1) return;
    if (this.game.playerKnock([...this.selected][0]!)) this.afterAction();
  }

  private onGoRummy(): void {
    if (this.animating) return;
    const discard = this.selected.size === 1 ? [...this.selected][0]! : null;
    if (this.game.playerGoRummy(discard)) this.afterAction();
  }

  private onAction(): void {
    if (this.animating) return;
    const state = this.game.getState();
    if (state.phase === "ROUND_OVER") {
      this.game.nextRound();
      this.afterAction();
    } else if (state.phase === "GAME_OVER") {
      location.hash = "/";
    }
  }

  private async scheduleBotTurn(): Promise<void> {
    if (this.destroyed) return;
    this.animating = true;
    await this.delay(700);
    if (this.destroyed) return;
    this.game.botTurn();
    this.animating = false;
    this.render();
    if (this.game.getState().phase === "BOT_TURN") this.scheduleBotTurn();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private render(): void {
    if (this.destroyed) return;
    const state = this.game.getState();
    const cfg = this.game.getConfig();

    this.$("player-score").textContent = String(state.playerScore);
    this.$("computer-score").textContent = String(state.computerScore);
    const pct = (score: number) =>
      `${Math.min(100, Math.max(0, (score / cfg.targetScore) * 100))}%`;
    this.$("player-peg").style.width = pct(state.playerScore);
    this.$("computer-peg").style.width = pct(state.computerScore);
    this.$("message").textContent = state.message;

    this.renderComputerHand(state);
    this.renderTable(state);
    this.renderPlayArea(state);
    this.renderPlayerHand(state);
    this.renderKnockSummary(state);
    this.renderButtons(state);
  }

  private renderComputerHand(state: Readonly<RummyState>): void {
    const container = this.$("computer-hand");
    const reveal = state.phase === "ROUND_OVER" || state.phase === "GAME_OVER";
    container.innerHTML = reveal
      ? state.computerHand.map((c) => renderCard(c, { small: true })).join("")
      : state.computerHand.map((_, i) => renderFaceDownCard(i, true)).join("");
  }

  private renderTable(state: Readonly<RummyState>): void {
    const table = this.$("rummy-table");
    if (!this.game.getConfig().meldsOnTable) {
      table.classList.add("hidden");
      return;
    }
    table.classList.remove("hidden");

    const targets = new Set(
      this.selected.size === 1
        ? this.game.layOffTargetsFor([...this.selected][0]!)
        : [],
    );
    const meldHtml = (m: TableMeld, i: number) => `
      <div class="rummy-meld ${targets.has(i) ? "rummy-layoff-target" : ""}" data-meld-index="${i}">
        ${m.cards.map((c) => renderCard(c, { small: true })).join("")}
      </div>`;

    this.$("their-melds").innerHTML =
      state.tableMelds
        .map((m, i) => (m.owner === "computer" ? meldHtml(m, i) : ""))
        .join("") || '<div class="rummy-zone-empty">—</div>';
    this.$("your-melds").innerHTML =
      state.tableMelds
        .map((m, i) => (m.owner === "player" ? meldHtml(m, i) : ""))
        .join("") || '<div class="rummy-zone-empty">—</div>';
  }

  private renderPlayArea(state: Readonly<RummyState>): void {
    const cfg = this.game.getConfig();
    const stockEl = this.$("rummy-stock");
    const discardEl = this.$("rummy-discard");
    const isDrawing =
      state.phase === "PLAYER_TURN" && state.currentTurn === "player";

    stockEl.innerHTML =
      state.stock.length > 0
        ? `<div class="pile-label">Stock (${state.stock.length})</div>${renderFaceDownCard()}`
        : `<div class="pile-label">Stock (0)</div><div class="card-slot"></div>`;
    stockEl.style.cursor = isDrawing ? "pointer" : "default";

    if (state.discardPile.length === 0) {
      discardEl.innerHTML = `<div class="pile-label">Discard</div><div class="card-slot"></div>`;
    } else if (cfg.discardPickup === "any") {
      discardEl.innerHTML = `<div class="pile-label">Discard row</div>
        <div class="rummy-discard-row">${state.discardPile
          .map((c, depth) => {
            const html = renderCard(c, { small: true });
            return html.replace('data-index="-1"', `data-depth="${depth}"`);
          })
          .join("")}</div>`;
    } else {
      const top = state.discardPile[state.discardPile.length - 1]!;
      discardEl.innerHTML = `<div class="pile-label">Discard (${state.discardPile.length})</div>${renderCard(top)}`;
    }
    discardEl.style.cursor = isDrawing ? "pointer" : "default";
  }

  private renderPlayerHand(state: Readonly<RummyState>): void {
    const container = this.$("player-hand");
    const melding =
      state.phase === "PLAYER_MELD" && state.currentTurn === "player";
    container.innerHTML = state.playerHand
      .map((c, i) =>
        renderCard(c, {
          index: i,
          selected: melding && this.selected.has(i),
          dimmed: state.phase === "PLAYER_TURN",
        }),
      )
      .join("");
    container.style.cursor = melding ? "pointer" : "default";
  }

  private renderKnockSummary(state: Readonly<RummyState>): void {
    const el = this.$("rummy-knock-summary");
    const kr = state.knockResult;
    if (!kr) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    el.classList.remove("hidden");
    el.innerHTML = `
      <div class="rummy-knock-row">
        <span>${kr.knocker === "player" ? "You knock" : "Computer knocks"}: ${kr.knockerDeadwoodValue} deadwood</span>
        <span>Defender: ${kr.defenderDeadwoodValue} deadwood</span>
        ${kr.isUndercut ? "<span>Undercut!</span>" : ""}
      </div>`;
  }

  private renderButtons(state: Readonly<RummyState>): void {
    const cfg = this.game.getConfig();
    const melding =
      state.phase === "PLAYER_MELD" && state.currentTurn === "player";
    const one = this.selected.size === 1;

    const show = (id: string, visible: boolean, enabled = true) => {
      const btn = this.$(id) as HTMLButtonElement;
      btn.classList.toggle("hidden", !visible);
      btn.disabled = !enabled;
    };

    show(
      "meld-btn",
      melding && cfg.meldsOnTable,
      this.game.isValidMeldSelection([...this.selected]),
    );
    show("discard-btn", melding, one && !this.game.discardBlocked());
    show("knock-btn", melding && cfg.knock !== null, one);
    show("rummy-btn", melding && cfg.mustGoRummy, this.game.canPlayerGoRummy());

    const actionBtn = this.$("action-btn") as HTMLButtonElement;
    if (state.phase === "ROUND_OVER") {
      actionBtn.textContent = "Next Round";
      actionBtn.classList.remove("hidden");
    } else if (state.phase === "GAME_OVER") {
      actionBtn.textContent = "Back to Game Room";
      actionBtn.classList.remove("hidden");
    } else {
      actionBtn.classList.add("hidden");
    }
  }
}
