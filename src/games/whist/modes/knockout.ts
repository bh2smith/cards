import type { Suit } from "typedeck";
import { createDeck, shuffle } from "../../../shared/deck";
import { KNOCKOUT_FIRST_HAND_SIZE } from "../config";
import {
  type ModeCtx,
  type PlayerIndex,
  PLAYER_LABELS,
  activeSeats,
  nextSeat,
  seatOrderFromEldest,
  sortWhistHand,
  startPlaying,
  suitName,
} from "../types";

/**
 * Knockout whist: individual play, one card fewer each hand (7, 6, …, 1).
 * Hand 1 turns trump from the deck; later hands the previous hand's trick
 * leader names trump after seeing their cards.
 */
export function dealKnockout(ctx: ModeCtx): void {
  const { state } = ctx;
  state.handSize = KNOCKOUT_FIRST_HAND_SIZE - (state.handNumber - 1);
  const deck = shuffle(createDeck(), ctx.rng);
  const order = seatOrderFromEldest(state);
  order.forEach((seat, i) => {
    state.hands[seat] = deck.slice(
      i * state.handSize,
      (i + 1) * state.handSize,
    );
  });
  state.stock = deck.slice(order.length * state.handSize);

  if (state.handNumber === 1) {
    const turned = state.stock.shift()!;
    state.trump = turned.suit;
    state.trumpCard = turned;
    for (const hand of state.hands) sortWhistHand(hand, state.trump);
    startPlaying(state, state.eldest);
    state.message = `Trump turned: ${suitName(turned.suit)}. ${state.handSize} cards each.`;
    return;
  }

  for (const hand of state.hands) sortWhistHand(hand, null);
  state.phase = "TRUMP_PICK";
  state.currentTurn = state.trumpChooser!;
  state.message =
    state.currentTurn === 0
      ? "You took the most tricks — choose trump."
      : `${PLAYER_LABELS[state.currentTurn]} is choosing trump…`;
}

export function knockoutPickTrump(
  ctx: ModeCtx,
  seat: PlayerIndex,
  suit: Suit,
): boolean {
  const { state } = ctx;
  if (state.phase !== "TRUMP_PICK" || state.currentTurn !== seat) return false;
  state.trump = suit;
  for (const hand of state.hands) sortWhistHand(hand, suit);
  startPlaying(state, seat); // trump chooser leads
  state.message = `${seat === 0 ? "You" : PLAYER_LABELS[seat]} name${seat === 0 ? "" : "s"} ${suitName(suit)} trump.`;
  return true;
}

/**
 * Zero-trick players are knocked out. The most-tricks player (earliest from
 * eldest on ties) chooses trump next hand. Last player standing wins; if all
 * remaining tie out at once, the last completed trick's winner wins.
 */
export function endKnockoutHand(ctx: ModeCtx): void {
  const { state } = ctx;
  const contenders = activeSeats(state);

  // Trump chooser before eliminations: most tricks, earliest from eldest.
  let chooser = state.eldest;
  let bestTricks = -1;
  let seat = state.eldest;
  for (let i = 0; i < 4; i++) {
    if (!state.eliminated[seat] && state.trickCounts[seat]! > bestTricks) {
      bestTricks = state.trickCounts[seat]!;
      chooser = seat;
    }
    seat = nextSeat(seat);
  }
  state.trumpChooser = chooser;

  const knockedOut = contenders.filter((s) => state.trickCounts[s] === 0);
  for (const s of knockedOut) state.eliminated[s] = true;
  const survivors = contenders.filter((s) => !state.eliminated[s]);

  if (survivors.length <= 1) {
    const winner = survivors[0] ?? state.lastTrickWinner!;
    state.phase = "GAME_OVER";
    state.winner = winner === 0 ? "player" : "computer";
    state.message =
      winner === 0
        ? "You are the last player standing — you win!"
        : `${PLAYER_LABELS[winner]} is the last player standing.`;
    return;
  }

  state.phase = "HAND_OVER";
  const outs =
    knockedOut.length > 0
      ? `${knockedOut.map((s) => PLAYER_LABELS[s]).join(" and ")} knocked out. `
      : "";
  state.message = `${outs}${chooser === 0 ? "You choose" : `${PLAYER_LABELS[chooser]} chooses`} trump next.`;
}
