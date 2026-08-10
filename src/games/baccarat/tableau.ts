import type { PlayingCard } from "typedeck";
import { cardOrder } from "../../shared/deck";

/** Baccarat card value: ace 1, pips at face value, tens and court cards 0. */
export function cardValue(card: PlayingCard): number {
  const order = cardOrder(card); // A=1 .. K=13
  return order >= 10 ? 0 : order;
}

/** Hand value: sum of card values, modulo ten. */
export function handTotal(cards: PlayingCard[]): number {
  return cards.reduce((sum, card) => sum + cardValue(card), 0) % 10;
}

/** A two-card 8 or 9 — the coup ends in an immediate showdown. */
export function isNatural(cards: PlayingCard[]): boolean {
  return cards.length === 2 && handTotal(cards) >= 8;
}

/** Player rule of the tableau: draw on 0–5, stand on 6–7. */
export function playerDraws(total: number): boolean {
  return total <= 5;
}

/**
 * Banker rule of the tableau. `playerThird` is the value of the player's
 * third card, or null when the player stood on two cards.
 */
export function bankerDraws(
  bankerTotal: number,
  playerThird: number | null,
): boolean {
  if (bankerTotal >= 7) return false;
  if (playerThird === null) return bankerTotal <= 5;
  if (bankerTotal <= 2) return true;
  switch (bankerTotal) {
    case 3:
      return playerThird !== 8;
    case 4:
      return playerThird >= 2 && playerThird <= 7;
    case 5:
      return playerThird >= 4 && playerThird <= 7;
    default:
      // 6
      return playerThird === 6 || playerThird === 7;
  }
}
