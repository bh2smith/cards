import { type PlayingCard, CardName } from "typedeck";
import { isRed, cardKey, RANK_DISPLAY, SUIT_SYMBOL } from "../deck";

export interface CardRenderOptions {
  index?: number;
  selected?: boolean;
  dimmed?: boolean;
  small?: boolean;
}

const FACE_RANKS = new Set([CardName.Jack, CardName.Queen, CardName.King]);

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

  const center = isFace
    ? `<span class="face-initial">${rank}</span><span class="face-suit">${suit}</span>`
    : suit;

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
