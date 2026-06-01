import { CardName, type PlayingCard } from "typedeck";
import { CuttleGame } from "./game";
import { renderCard, renderFaceDownCard } from "../../shared/ui/cards";
import { cardKey } from "../../shared/deck";
import { confirmIfEnabled } from "../../shared/settings";
import { openInstructions } from "../../shared/ui/instructions-modal";
import { LeaderboardReporter, GameId } from "../../shared/circles/leaderboard";
import {
  type CuttleState,
  type FieldCard,
  type Field,
  cardActions,
  twoTargets,
  nineTargets,
} from "./types";

type ChipKind =
  | "points"
  | "scuttle"
  | "oneoff"
  | "glasses"
  | "jack"
  | "king"
  | "queen";

const ONE_OFF_LABEL: Record<number, string> = {
  [CardName.Ace]: "Ace · scrap all points",
  [CardName.Two]: "Two · scrap a royal",
  [CardName.Three]: "Three · take from scrap",
  [CardName.Four]: "Four · foe discards 2",
  [CardName.Five]: "Five · draw 3",
  [CardName.Six]: "Six · scrap royals",
  [CardName.Seven]: "Seven · dig the deck",
  [CardName.Nine]: "Nine · bounce a card",
};

export class CuttleUI {
  private game: CuttleGame;
  private root: HTMLElement;
  private destroyed = false;
  private animating = false;
  private reporter = new LeaderboardReporter(GameId.Cuttle);

  // Interaction state (separate from the engine).
  private selectedKey: string | null = null;
  private mode: "idle" | "target" = "idle";
  private pendingKind: ChipKind | null = null;
  private targetKeys = new Set<string>();
  private discardSel = new Set<string>();

  constructor() {
    document.getElementById("app")!.innerHTML =
      `<div class="cuttle" id="cuttle-root"></div>`;
    this.root = document.getElementById("cuttle-root")!;
    this.game = new CuttleGame();
    this.root.addEventListener("click", (e) => this.onClick(e));
    this.render();
    this.maybeBot();
  }

  destroy(): void {
    this.destroyed = true;
    document.getElementById("app")!.innerHTML = "";
  }

  // --- Event routing ---

  private onClick(e: Event): void {
    if (this.animating) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-act],[data-chip],[data-target],[data-seven],[data-counter],[data-discard],[data-hand]",
    );
    if (!el) return;
    const d = el.dataset;
    if (d.act) return this.onAct(d.act);
    if (d.chip) return this.onChip(d.chip as ChipKind, d.key!);
    if (d.target !== undefined) return this.onTarget(d.target);
    if (d.seven) return this.onSelect(d.seven);
    if (d.counter) return this.onCounter(d.counter);
    if (d.discard) return this.onDiscardToggle(d.discard);
    if (d.hand) return this.onSelect(d.hand);
  }

  private onAct(act: string): void {
    const g = this.game;
    switch (act) {
      case "leave":
        confirmIfEnabled("Leave this game?", () => (location.hash = "/"));
        return;
      case "help":
        openInstructions("cuttle");
        return;
      case "again":
        g.newGame();
        this.reset();
        break;
      case "draw":
        if (!g.playerDraw()) return;
        this.reset();
        break;
      case "pass":
        if (!g.playerPass()) return;
        this.reset();
        break;
      case "decline":
        if (!g.playerDeclineCounter()) return;
        break;
      case "confirm-discard": {
        if (!g.playerDiscard([...this.discardSel])) return;
        this.discardSel.clear();
        break;
      }
      case "cancel":
        this.reset();
        this.render();
        return;
      default:
        return;
    }
    this.render();
    this.maybeBot();
  }

  private onSelect(key: string): void {
    // Toggle off if re-clicking the selected card.
    this.selectedKey = this.selectedKey === key ? null : key;
    this.mode = "idle";
    this.pendingKind = null;
    this.targetKeys.clear();
    this.render();
  }

  private onChip(kind: ChipKind, key: string): void {
    const card = this.cardByKey(key);
    if (!card) return;
    const a = cardActions(this.game.getState(), "player", card);

    const needsTarget =
      kind === "scuttle" ||
      kind === "jack" ||
      (kind === "oneoff" && a.oneOff.needsTarget);

    if (!needsTarget) {
      this.execute(kind, key);
      return;
    }

    this.targetKeys = new Set(this.targetsFor(kind, card));
    if (this.targetKeys.size === 0) return;
    this.pendingKind = kind;
    this.mode = "target";
    this.render();
  }

  private onTarget(targetKey: string): void {
    if (this.mode !== "target" || !this.pendingKind || !this.selectedKey)
      return;
    if (!this.targetKeys.has(targetKey)) return;
    this.execute(this.pendingKind, this.selectedKey, targetKey);
  }

  private onCounter(key: string): void {
    if (!this.game.playerCounter(key)) return;
    this.render();
    this.maybeBot();
  }

  private onDiscardToggle(key: string): void {
    if (this.discardSel.has(key)) this.discardSel.delete(key);
    else this.discardSel.add(key);
    this.render();
  }

  /** Run a chip action through the right engine method (normal or Seven). */
  private execute(kind: ChipKind, key: string, targetKey?: string): void {
    const seven = this.game.getState().phase === "PLAYER_SEVEN";
    const g = this.game;
    let ok = false;
    switch (kind) {
      case "points":
        ok = seven ? g.playerSeven(key, "points") : g.playerPoints(key);
        break;
      case "glasses":
        ok = seven ? g.playerSeven(key, "glasses") : g.playerGlasses(key);
        break;
      case "king":
        ok = seven ? g.playerSeven(key, "king") : g.playerKing(key);
        break;
      case "queen":
        ok = seven ? g.playerSeven(key, "queen") : g.playerQueen(key);
        break;
      case "scuttle":
        ok = seven
          ? g.playerSeven(key, "scuttle", targetKey)
          : g.playerScuttle(key, targetKey!);
        break;
      case "jack":
        ok = seven
          ? g.playerSeven(key, "jack", targetKey)
          : g.playerJack(key, targetKey!);
        break;
      case "oneoff":
        ok = seven
          ? g.playerSeven(key, "oneoff", targetKey)
          : g.playerOneOff(key, targetKey);
        break;
    }
    if (!ok) return;
    this.reset();
    this.render();
    this.maybeBot();
  }

  private maybeBot(): void {
    if (this.destroyed) return;
    if (this.game.getState().phase !== "BOT_TURN") return;
    this.animating = true;
    this.render();
    setTimeout(() => {
      if (this.destroyed) return;
      this.game.botTurn();
      this.animating = false;
      this.render();
      this.maybeBot();
    }, 750);
  }

  private reset(): void {
    this.selectedKey = null;
    this.mode = "idle";
    this.pendingKind = null;
    this.targetKeys.clear();
  }

  // --- Lookups ---

  private cardByKey(key: string): PlayingCard | undefined {
    const s = this.game.getState();
    return (
      s.hands.player.find((c) => cardKey(c) === key) ??
      s.sevenCards?.find((c) => cardKey(c) === key)
    );
  }

  private targetsFor(kind: ChipKind, card: PlayingCard): string[] {
    const s = this.game.getState();
    if (kind === "scuttle")
      return cardActions(s, "player", card).scuttle.map((t) => cardKey(t.card));
    if (kind === "jack")
      return cardActions(s, "player", card).jack.map((t) => cardKey(t.card));
    // one-off targets
    if (card.cardName === CardName.Two)
      return twoTargets(s, "player").map((t) => cardKey(t.card));
    if (card.cardName === CardName.Nine)
      return nineTargets(s, "player").map((t) => cardKey(t.card));
    if (card.cardName === CardName.Three) return s.scrap.map(cardKey);
    return [];
  }

  // --- Rendering ---

  private render(): void {
    if (this.destroyed) return;
    const s = this.game.getState();
    this.reporter.reportVsAi(s.phase, s.winner === "player");

    const playerSeesFoe = s.fields.player.glasses.length > 0;
    const foeSeesYou = s.fields.computer.glasses.length > 0;

    this.root.innerHTML = `
      <div class="header">
        <div class="header-left">
          <a href="#" class="back-link" data-act="leave">← Games</a>
          <h1>Cuttle</h1>
        </div>
        <div class="header-right">
          <button class="help-btn" data-act="help" type="button" aria-label="How to play">?</button>
          <button data-act="leave" type="button">New Game</button>
        </div>
      </div>

      <div class="cuttle-side cuttle-foe">
        <div class="cuttle-readout">
          <span class="cuttle-name">Opponent</span>
          <span class="cuttle-pts">${this.game.total("computer")} pts</span>
          <span class="cuttle-goal">win at ${this.game.threshold("computer")}</span>
          ${foeSeesYou ? `<span class="cuttle-glasses-note">👓 sees your hand</span>` : ""}
        </div>
        <div class="cuttle-hand cuttle-foe-hand">${this.foeHand(s, playerSeesFoe)}</div>
        ${this.fieldHtml(s.fields.computer, "computer")}
      </div>

      <div class="cuttle-center">
        <div class="cuttle-pile">
          <div class="pile-label">Deck (${s.deck.length})</div>
          ${s.deck.length ? renderFaceDownCard(-1, true) : `<div class="card-slot"></div>`}
        </div>
        <div class="cuttle-message" id="cuttle-message">${s.message}</div>
        <div class="cuttle-pile">
          <div class="pile-label">Scrap (${s.scrap.length})</div>
          ${this.scrapHtml(s)}
        </div>
      </div>

      <div class="cuttle-side cuttle-me">
        ${this.fieldHtml(s.fields.player, "player")}
        <div class="cuttle-readout">
          <span class="cuttle-name">You</span>
          <span class="cuttle-pts">${this.game.total("player")} pts</span>
          <span class="cuttle-goal">win at ${this.game.threshold("player")}</span>
        </div>
        <div class="cuttle-hand cuttle-my-hand">${this.myHand(s)}</div>
      </div>

      <div class="cuttle-control">${this.controlHtml(s)}</div>
    `;
  }

  private foeHand(s: CuttleState, reveal: boolean): string {
    if (reveal)
      return s.hands.computer
        .map((c) => renderCard(c, { small: true }))
        .join("");
    return s.hands.computer.map((_, i) => renderFaceDownCard(i, true)).join("");
  }

  private scrapHtml(s: CuttleState): string {
    const top = s.scrap[s.scrap.length - 1];
    // During a Three (or its Seven equivalent), the whole scrap is targetable.
    const targeting = this.mode === "target" && this.pendingKind === "oneoff";
    if (targeting) {
      return `<div class="cuttle-scrap-pick">${s.scrap
        .map((c) => this.wrapTarget(c, true))
        .join("")}</div>`;
    }
    return top
      ? renderCard(top, { small: true })
      : `<div class="card-slot"></div>`;
  }

  private fieldHtml(field: Field, owner: "player" | "computer"): string {
    const targetable = (fc: FieldCard) =>
      this.mode === "target" &&
      owner === "computer" &&
      this.targetKeys.has(cardKey(fc.card));
    const royals = [...field.kings, ...field.queens, ...field.glasses];
    return `
      <div class="cuttle-field">
        <div class="cuttle-row cuttle-points">
          ${field.points.map((fc) => this.fieldCard(fc, targetable(fc))).join("") || `<span class="cuttle-empty">no points</span>`}
        </div>
        <div class="cuttle-row cuttle-royals">
          ${royals.map((fc) => this.fieldCard(fc, targetable(fc))).join("") || ""}
        </div>
      </div>
    `;
  }

  private fieldCard(fc: FieldCard, targetable: boolean): string {
    const inner =
      renderCard(fc.card, { small: true }) +
      (fc.jacks.length
        ? `<span class="cuttle-jacks">J×${fc.jacks.length}</span>`
        : "");
    const attrs = targetable ? ` data-target="${cardKey(fc.card)}"` : "";
    return `<div class="cuttle-fieldcard ${targetable ? "cuttle-target" : ""}"${attrs}>${inner}</div>`;
  }

  private wrapTarget(card: PlayingCard, targetable: boolean): string {
    const attrs = targetable ? ` data-target="${cardKey(card)}"` : "";
    return `<div class="cuttle-fieldcard ${targetable ? "cuttle-target" : ""}"${attrs}>${renderCard(card, { small: true })}</div>`;
  }

  private myHand(s: CuttleState): string {
    const myTurn = s.phase === "PLAYER_TURN" && this.mode !== "target";

    if (s.phase === "PLAYER_COUNTER") {
      return s.hands.player
        .map((c) => {
          const isTwo = c.cardName === CardName.Two;
          const attrs = isTwo ? ` data-counter="${cardKey(c)}"` : "";
          return `<div class="cuttle-handcard ${isTwo ? "cuttle-can-counter" : ""}"${attrs}>${renderCard(c, { dimmed: !isTwo })}</div>`;
        })
        .join("");
    }

    if (s.phase === "PLAYER_DISCARD") {
      return s.hands.player
        .map((c) => {
          const k = cardKey(c);
          const sel = this.discardSel.has(k);
          return `<div class="cuttle-handcard" data-discard="${k}">${renderCard(c, { selected: sel })}</div>`;
        })
        .join("");
    }

    const sevenKeys =
      s.phase === "PLAYER_SEVEN" ? new Set(s.sevenCards?.map(cardKey)) : null;

    return s.hands.player
      .map((c) => {
        const k = cardKey(c);
        const frozen = this.game.isFrozen("player", c);
        const clickable = myTurn && !frozen && !sevenKeys;
        const attrs = clickable ? ` data-hand="${k}"` : "";
        return `<div class="cuttle-handcard"${attrs}>${renderCard(c, { selected: k === this.selectedKey, dimmed: frozen || !!sevenKeys })}</div>`;
      })
      .join("");
  }

  private controlHtml(s: CuttleState): string {
    if (s.phase === "GAME_OVER") {
      return `<div class="cuttle-banner">
        <span>${s.message}</span>
        <button data-act="again" type="button">Play Again</button>
        <button data-act="leave" type="button">Game Room</button>
      </div>`;
    }

    if (s.phase === "BOT_TURN") {
      return `<div class="cuttle-banner cuttle-thinking">Opponent is thinking…</div>`;
    }

    if (s.phase === "PLAYER_COUNTER") {
      const hasTwo = s.hands.player.some((c) => c.cardName === CardName.Two);
      return `<div class="cuttle-banner">
        <span>${s.message}</span>
        ${hasTwo ? `<span class="cuttle-hint">Tap a Two to counter.</span>` : `<span class="cuttle-hint">No Two to counter.</span>`}
        <button data-act="decline" type="button">${hasTwo ? "Pass" : "Continue"}</button>
      </div>`;
    }

    if (s.phase === "PLAYER_DISCARD") {
      const need = Math.min(s.discardCount, s.hands.player.length);
      const ready = this.discardSel.size === need;
      return `<div class="cuttle-banner">
        <span>Select ${need} card${need > 1 ? "s" : ""} to discard (${this.discardSel.size}/${need}).</span>
        <button data-act="confirm-discard" type="button" ${ready ? "" : "disabled"}>Discard</button>
      </div>`;
    }

    if (s.phase === "PLAYER_SEVEN") {
      if (
        !this.selectedKey ||
        !s.sevenCards?.some((c) => cardKey(c) === this.selectedKey)
      ) {
        return `<div class="cuttle-banner">
          <span>Seven — choose a card to play:</span>
          <div class="cuttle-seven">
            ${(s.sevenCards ?? [])
              .map(
                (c) =>
                  `<div class="cuttle-handcard cuttle-can-counter" data-seven="${cardKey(c)}">${renderCard(c)}</div>`,
              )
              .join("")}
          </div>
        </div>`;
      }
      // A seven card is chosen — show its action chips.
      return `<div class="cuttle-banner">${this.chipsHtml(s, this.selectedKey)}</div>`;
    }

    // PLAYER_TURN
    if (this.mode === "target") {
      return `<div class="cuttle-banner">
        <span class="cuttle-hint">Choose a target.</span>
        <button data-act="cancel" type="button">Cancel</button>
      </div>`;
    }

    if (this.selectedKey) {
      return `<div class="cuttle-banner">${this.chipsHtml(s, this.selectedKey)}</div>`;
    }

    const deckEmpty = s.deck.length === 0;
    const handFull = s.hands.player.length >= 8;
    return `<div class="cuttle-banner">
      <span class="cuttle-hint">Select a card, or ${deckEmpty ? "pass" : "draw"}.</span>
      ${
        deckEmpty
          ? `<button data-act="pass" type="button">Pass</button>`
          : `<button data-act="draw" type="button" ${handFull ? "disabled" : ""}>Draw</button>`
      }
    </div>`;
  }

  private chipsHtml(s: CuttleState, key: string): string {
    const card = this.cardByKey(key);
    if (!card) return "";
    const a = cardActions(s, "player", card);
    const chips: string[] = [];
    const chip = (kind: ChipKind, label: string) =>
      chips.push(
        `<button class="cuttle-chip" data-chip="${kind}" data-key="${key}" type="button">${label}</button>`,
      );

    if (a.points) chip("points", `Points +${card.cardName + 1}`);
    if (a.scuttle.length) chip("scuttle", "Scuttle");
    if (a.jack.length) chip("jack", "Jack · steal");
    if (a.king) chip("king", "King");
    if (a.queen) chip("queen", "Queen · protect");
    if (a.glasses) chip("glasses", "Glasses 👓");
    if (a.oneOff.playable)
      chip("oneoff", ONE_OFF_LABEL[card.cardName] ?? "One-off");

    return `<div class="cuttle-actions">${chips.join("")}</div><button data-act="cancel" type="button" class="cuttle-cancel">Cancel</button>`;
  }
}
