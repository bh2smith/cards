// Shared landscape table layout for 3+ player games (Hearts, Euchre, …).
//
// These games are LANDSCAPE-LOCKED: entering one breaks the app out of its
// 480px portrait column (see `enterTableMode`) and renders a wide felt table —
// opponents seated Left / Top / Right, the player's hand fanned along the
// bottom, and a central trick area. The shell here is purely structural: it
// emits stable element ids and `tt-*` classes; each game fills in the data
// (scores, hands, trick cards, messages, action buttons).

import { renderFaceDownCard } from "./cards";

export type TablePos = "self" | "left" | "top" | "right";

/**
 * Max face-down backs shown for an opponent's hand. The stack is bounded so it
 * never overflows the felt on short landscape heights; the count still thins
 * visibly over the last tricks of a round. (Hearts deals 13, Euchre 5.)
 */
const SEAT_HAND_CAP = 8;

export interface TableSeatLabels {
  self: string;
  left: string;
  top: string;
  right: string;
}

export interface TableLayoutOptions {
  /** Display title shown in the header (e.g. "Hearts"). */
  title: string;
  /** Seat labels keyed by compass position. */
  labels: TableSeatLabels;
  /** Optional team index (0 or 1) per seat, used to accent partnerships. */
  teams?: Partial<Record<TablePos, number>>;
}

const OPPONENTS: Exclude<TablePos, "self">[] = ["left", "top", "right"];
const ALL_POS: TablePos[] = ["self", "left", "top", "right"];

/**
 * Switch the app shell into landscape table mode. Adds `tt-mode` to <body>,
 * which widens `#app` past the portrait cap and lets the table fill the space.
 * Call `exitTableMode()` from the game's `destroy()`.
 */
export function enterTableMode(): void {
  document.body.classList.add("tt-mode");
}

export function exitTableMode(): void {
  document.body.classList.remove("tt-mode");
}

function teamClass(opts: TableLayoutOptions, pos: TablePos): string {
  const t = opts.teams?.[pos];
  return t === undefined ? "" : ` tt-team-${t}`;
}

function scoreCell(opts: TableLayoutOptions, pos: TablePos): string {
  return `
    <div class="tt-score-cell${teamClass(opts, pos)}" id="tt-score-${pos}">
      <div class="tt-score-name">${opts.labels[pos]}</div>
      <div class="tt-score-total" id="tt-score-total-${pos}">0</div>
      <div class="tt-score-sub" id="tt-score-sub-${pos}"></div>
    </div>`;
}

function seat(
  opts: TableLayoutOptions,
  pos: Exclude<TablePos, "self">,
): string {
  return `
    <div class="tt-seat tt-seat-${pos}${teamClass(opts, pos)}" id="tt-seat-${pos}">
      <div class="tt-plate" id="tt-plate-${pos}">
        <span class="tt-plate-dot"></span>
        <span class="tt-plate-name">${opts.labels[pos]}</span>
      </div>
      <div class="tt-seat-hand" id="tt-seathand-${pos}"></div>
    </div>`;
}

/**
 * Renders an opponent's hidden hand as a bounded fan of face-down backs. Pass
 * the real card count; the fan caps at `SEAT_HAND_CAP` but shrinks below it so
 * the hand thins as the round ends. Returns "" for an empty hand.
 */
export function faceDownFanHtml(count: number): string {
  const n = Math.min(Math.max(count, 0), SEAT_HAND_CAP);
  let html = "";
  for (let i = 0; i < n; i++) html += renderFaceDownCard(i, true);
  return html;
}

/**
 * Wraps a played card (or empty slot) in a positioned trick cell. `pos` is the
 * compass position of the player who played it; `playIn` triggers the slide-in
 * animation. Shared so every table game lands cards in the same spots.
 */
export function trickCardHtml(
  pos: TablePos,
  inner: string,
  opts: { playIn?: boolean } = {},
): string {
  const cls = `tt-trick-card tt-pos-${pos}${opts.playIn ? " tt-play-in" : ""}`;
  return `<div class="${cls}">${inner}</div>`;
}

/**
 * Returns the full innerHTML for `#app` in table mode. Header buttons
 * (`help-btn`, `new-game-btn`) and the seat / trick / hand / message / action
 * containers are exposed by id for the game to populate and bind.
 */
export function tableLayoutHtml(opts: TableLayoutOptions): string {
  return `
    <div class="header">
      <div class="header-left">
        <a href="#" class="back-link">← Games</a>
        <h1>${opts.title}</h1>
      </div>
      <div class="header-right">
        <button class="help-btn" id="help-btn" type="button" aria-label="How to play">?</button>
        <button id="new-game-btn" type="button">New Game</button>
      </div>
    </div>

    <div class="tt-scoreboard" id="tt-scoreboard">
      ${ALL_POS.map((p) => scoreCell(opts, p)).join("")}
    </div>

    <div class="tt-table" id="tt-table">
      ${OPPONENTS.map((p) => seat(opts, p)).join("")}
      <div class="tt-felt" id="tt-felt">
        <div class="tt-felt-badge" id="tt-felt-badge"></div>
        <div class="tt-trick" id="tt-trick"></div>
      </div>
    </div>

    <div class="tt-hand" id="tt-hand"></div>

    <div class="message-bar tt-message" id="tt-message"></div>

    <div class="action-area tt-actions" id="tt-actions"></div>
  `;
}
