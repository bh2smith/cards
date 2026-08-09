import { createDeck, shuffle } from "../../../shared/deck";
import {
  type ModeCtx,
  PLAYER_LABELS,
  cardLabel,
  seatOrderFromEldest,
  sortWhistHand,
  startPlaying,
  suitName,
} from "../types";

/**
 * Classic partnership whist: 13 cards each, dealt in rotation so the dealer's
 * last card is turned to fix trump — the dealer keeps it in hand.
 */
export function dealWhist(ctx: ModeCtx): void {
  const { state } = ctx;
  const deck = shuffle(createDeck(), ctx.rng);
  const order = seatOrderFromEldest(state);
  order.forEach((seat, i) => {
    state.hands[seat] = deck.slice(i * 13, (i + 1) * 13);
  });
  state.handSize = 13;

  const turned = deck[51]!; // dealer is last in the deal order
  state.trump = turned.suit;
  state.trumpCard = turned;
  state.trumpCardInHand = true;
  for (const hand of state.hands) sortWhistHand(hand, state.trump);

  startPlaying(state, state.eldest);
  state.message = `Dealer turns the ${cardLabel(turned)} — ${suitName(turned.suit)} are trump.`;
}

/** One point per odd trick (beyond six) to the majority team; game at target. */
export function endWhistHand(ctx: ModeCtx): void {
  const { state } = ctx;
  const t0 = state.trickCounts[0]! + state.trickCounts[2]!;
  const t1 = state.trickCounts[1]! + state.trickCounts[3]!;
  const team = t0 > t1 ? 0 : 1;
  const odd = Math.max(t0, t1) - 6;
  state.teamScores[team] += odd;

  const side = team === 0 ? "Your side" : "Left & Right";
  const target = ctx.cfg.targetScore ?? 7;
  if (state.teamScores[team]! >= target) {
    state.phase = "GAME_OVER";
    state.winner = team === 0 ? "player" : "computer";
    state.message = `${side} win${team === 0 ? "" : "s"} the game ${state.teamScores[team]}–${state.teamScores[1 - team]}!`;
    return;
  }
  state.phase = "HAND_OVER";
  const winnerLabel = team === 0 ? "You & Top" : PLAYER_LABELS[1] + " & Right";
  state.message = `${winnerLabel} take ${Math.max(t0, t1)} tricks — +${odd} point${odd === 1 ? "" : "s"}.`;
}
