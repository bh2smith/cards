import { type PlayingCard, CardName } from "typedeck";
import { isRed, cardKey, RANK_DISPLAY, SUIT_SYMBOL } from "../deck";

export interface CardRenderOptions {
  index?: number;
  selected?: boolean;
  dimmed?: boolean;
  small?: boolean;
}

const FACE_RANKS = new Set([CardName.Jack, CardName.Queen, CardName.King]);

const FACE_SVGS: Record<number, string> = {
  [CardName.Jack]: `<svg viewBox="0 0 40 56" fill="currentColor" class="face-portrait">
    <ellipse cx="20" cy="16" rx="10" ry="4" opacity=".8"/>
    <path d="M10 16L12 12h16l2 4" opacity=".6"/>
    <rect x="10" y="15" width="20" height="1.5" rx=".75" opacity=".5"/>
    <path d="M29 13q4-6 5-9" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".45" stroke-linecap="round"/>
    <path d="M30 11q4-3 3-6" fill="none" stroke="currentColor" stroke-width=".6" opacity=".3"/>
    <circle cx="20" cy="25" r="6" fill-opacity=".06" stroke="currentColor" stroke-width="1.2"/>
    <ellipse cx="17.8" cy="24" rx="1" ry=".9"/><ellipse cx="22.2" cy="24" rx="1" ry=".9"/>
    <path d="M17.5 27.5q2.5 1.5 5 0" fill="none" stroke="currentColor" stroke-width=".6"/>
    <path d="M10 32q10 5 20 0v20H10z" opacity=".1"/>
    <path d="M10 32q10 5 20 0" fill="none" stroke="currentColor" stroke-width="1.1"/>
    <path d="M16.5 32l3.5 4 3.5-4" fill="none" stroke="currentColor" stroke-width=".8"/>
    <rect x="12" y="42" width="16" height="1.2" rx=".6" opacity=".15"/>
    <rect x="33" y="22" width="1.3" height="24" rx=".65" opacity=".4"/>
    <path d="M31 23q2-4 5.5 0L34 28z" opacity=".3"/>
  </svg>`,
  [CardName.Queen]: `<svg viewBox="0 0 40 56" fill="currentColor" class="face-portrait">
    <path d="M13 16q1-8 4-6 1-5 3-2 2-5 3-2 3-8 4 6z"/>
    <rect x="13" y="14.5" width="14" height="2.5" rx="1" opacity=".65"/>
    <circle cx="20" cy="10" r="1.2" opacity=".7"/>
    <circle cx="20" cy="24" r="6" fill-opacity=".06" stroke="currentColor" stroke-width="1.2"/>
    <ellipse cx="17.8" cy="23" rx="1" ry=".9"/><ellipse cx="22.2" cy="23" rx="1" ry=".9"/>
    <path d="M17.5 26q2.5 2.5 5 0" fill="none" stroke="currentColor" stroke-width=".65"/>
    <path d="M14 20q-3 6-4 14" fill="none" stroke="currentColor" stroke-width="2.2" opacity=".18" stroke-linecap="round"/>
    <path d="M26 20q3 6 4 14" fill="none" stroke="currentColor" stroke-width="2.2" opacity=".18" stroke-linecap="round"/>
    <path d="M10 31q10 5 20 0v21H10z" opacity=".1"/>
    <path d="M10 31q10 5 20 0" fill="none" stroke="currentColor" stroke-width="1.1"/>
    <path d="M17 31l3 3.5 3-3.5" fill="none" stroke="currentColor" stroke-width=".7"/>
    <circle cx="20" cy="38" r="2" fill-opacity=".06" stroke="currentColor" stroke-width=".6"/>
    <circle cx="7" cy="38" r="3" opacity=".15"/><circle cx="7" cy="38" r="1.5" opacity=".35"/>
  </svg>`,
  [CardName.King]: `<svg viewBox="0 0 40 56" fill="currentColor" class="face-portrait">
    <polygon points="11,16 13.5,6 16.5,12.5 20,3 23.5,12.5 26.5,6 29,16"/>
    <rect x="11" y="14.5" width="18" height="2.5" rx="1" opacity=".65"/>
    <circle cx="20" cy="24" r="6" fill-opacity=".06" stroke="currentColor" stroke-width="1.2"/>
    <ellipse cx="17.8" cy="23" rx="1" ry=".9"/><ellipse cx="22.2" cy="23" rx="1" ry=".9"/>
    <path d="M16 27q4 4 8 0" opacity=".2"/>
    <path d="M9 31q11 6 22 0v21H9z" opacity=".1"/>
    <path d="M9 31q11 6 22 0" fill="none" stroke="currentColor" stroke-width="1.1"/>
    <path d="M16.5 31l3.5 5 3.5-5" fill="none" stroke="currentColor" stroke-width=".8"/>
    <rect x="13" y="42" width="14" height="1.2" rx=".6" opacity=".15"/>
    <rect x="33" y="17" width="1.4" height="28" rx=".7" opacity=".4"/>
    <rect x="30.5" y="23" width="6.4" height="1.4" rx=".7" opacity=".4"/>
    <circle cx="33.7" cy="16" r="1.5" opacity=".3"/>
  </svg>`,
};

export function renderCard(
  card: PlayingCard,
  opts: CardRenderOptions = {},
): string {
  const { index = -1, selected = false, dimmed = false, small = false } = opts;
  const red = isRed(card);
  const rank = RANK_DISPLAY[card.cardName];
  const suit = SUIT_SYMBOL[card.suit];
  const isFace = FACE_RANKS.has(card.cardName);
  const classes = [
    "card",
    red ? "red" : "black",
    isFace ? "face-card" : "",
    selected ? "selected" : "",
    dimmed ? "dimmed" : "",
    small ? "small" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const center = isFace ? FACE_SVGS[card.cardName] : suit;

  return `<div class="${classes}" data-index="${index}" data-key="${cardKey(card)}">
    <div class="card-corner top">${rank}<br>${suit}</div>
    <div class="card-center">${center}</div>
    <div class="card-corner bottom">${rank}<br>${suit}</div>
  </div>`;
}

export function renderFaceDownCard(index: number = -1, small = false): string {
  const classes = ["card", "face-down", small ? "small" : ""]
    .filter(Boolean)
    .join(" ");
  return `<div class="${classes}" data-index="${index}"></div>`;
}
