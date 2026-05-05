import { type PlayingCard } from "typedeck";
import { isRed, cardKey, RANK_DISPLAY, SUIT_SYMBOL } from "../deck";

export interface CardRenderOptions {
  index?: number;
  selected?: boolean;
  dimmed?: boolean;
  small?: boolean;
}

export function renderCard(
  card: PlayingCard,
  opts: CardRenderOptions = {},
): string {
  const { index = -1, selected = false, dimmed = false, small = false } = opts;
  const red = isRed(card);
  const rank = RANK_DISPLAY[card.cardName];
  const suit = SUIT_SYMBOL[card.suit];
  const classes = [
    "card",
    red ? "red" : "black",
    selected ? "selected" : "",
    dimmed ? "dimmed" : "",
    small ? "small" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<div class="${classes}" data-index="${index}" data-key="${cardKey(card)}">
    <div class="card-corner top">${rank}<br>${suit}</div>
    <div class="card-center">${suit}</div>
    <div class="card-corner bottom">${rank}<br>${suit}</div>
  </div>`;
}

export function renderFaceDownCard(index: number = -1, small = false): string {
  const classes = ["card", "face-down", small ? "small" : ""]
    .filter(Boolean)
    .join(" ");
  return `<div class="${classes}" data-index="${index}"></div>`;
}
