import { type PlayingCard, CardName, Suit } from "typedeck";
import { isRed, cardKey, RANK_DISPLAY, SUIT_SYMBOL } from "../deck";

export interface CardRenderOptions {
  index?: number;
  selected?: boolean;
  dimmed?: boolean;
  small?: boolean;
}

const FACE_RANKS = new Set([CardName.Jack, CardName.Queen, CardName.King]);

const SUIT_PREFIX: Record<number, string> = {
  [Suit.Clubs]: "club",
  [Suit.Spades]: "spade",
  [Suit.Diamonds]: "diamond",
  [Suit.Hearts]: "heart",
};

const RANK_SUFFIX: Record<number, string> = {
  [CardName.Jack]: "jack",
  [CardName.Queen]: "queen",
  [CardName.King]: "king",
};

let spriteInjected = false;

export async function injectCardSprite(): Promise<void> {
  if (spriteInjected) return;
  spriteInjected = true;

  const resp = await fetch("/assets/svg-cards.svg");
  const text = await resp.text();
  const container = document.createElement("div");
  container.style.display = "none";
  container.innerHTML = text;
  document.body.prepend(container);
}

function faceCardSvg(card: PlayingCard): string {
  const id = `${SUIT_PREFIX[card.suit]}_${RANK_SUFFIX[card.cardName]}`;
  return `<svg viewBox="0 0 169.075 244.640" class="face-portrait"><use href="#${id}"/></svg>`;
}

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

  if (isFace) {
    return `<div class="${classes}" data-index="${index}" data-key="${cardKey(card)}">
      ${faceCardSvg(card)}
    </div>`;
  }

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
