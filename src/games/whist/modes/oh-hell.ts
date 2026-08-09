import { createDeck, shuffle } from "../../../shared/deck";
import { OH_HELL_MAX_HANDS } from "../config";
import {
  type ModeCtx,
  type PlayerIndex,
  type WhistState,
  PLAYER_LABELS,
  nextSeat,
  seatOrderFromEldest,
  sortWhistHand,
  startPlaying,
  suitName,
} from "../types";

/**
 * Oh Hell: hand sizes run 1, 2, …, 10; trump is turned from the remainder
 * each deal. Everyone bids an exact trick count before play, eldest first,
 * dealer last.
 */
export function dealOhHell(ctx: ModeCtx): void {
  const { state } = ctx;
  state.handSize = state.handNumber;
  const deck = shuffle(createDeck(), ctx.rng);
  const order = seatOrderFromEldest(state);
  order.forEach((seat, i) => {
    state.hands[seat] = deck.slice(
      i * state.handSize,
      (i + 1) * state.handSize,
    );
  });
  state.stock = deck.slice(order.length * state.handSize);

  const turned = state.stock.shift()!;
  state.trump = turned.suit;
  state.trumpCard = turned;
  for (const hand of state.hands) sortWhistHand(hand, state.trump);

  state.phase = "BIDDING";
  state.currentTurn = state.eldest;
  state.message = `Hand ${state.handNumber}: ${state.handSize} card${state.handSize === 1 ? "" : "s"}, ${suitName(turned.suit)} trump. Bids?`;
}

/**
 * The dealer's forbidden "hook" bid for `seat`: the value that would make the
 * bids sum to the hand size. Null for non-dealers or when out of range.
 */
export function ohHellForbiddenBid(
  state: WhistState,
  seat: PlayerIndex,
): number | null {
  if (state.mode !== "oh-hell" || seat !== state.dealer) return null;
  let sum = 0;
  for (let p = 0; p < 4; p++) {
    if (p === seat) continue;
    const bid = state.bids[p];
    if (bid === null) return null; // earlier bidders still to act
    sum += bid;
  }
  const hook = state.handSize - sum;
  return hook >= 0 && hook <= state.handSize ? hook : null;
}

export function ohHellBid(
  ctx: ModeCtx,
  seat: PlayerIndex,
  bid: number,
): boolean {
  const { state } = ctx;
  if (state.phase !== "BIDDING" || state.currentTurn !== seat) return false;
  if (!Number.isInteger(bid) || bid < 0 || bid > state.handSize) return false;
  if (ohHellForbiddenBid(state, seat) === bid) return false;

  state.bids[seat] = bid;
  if (seat === state.dealer) {
    startPlaying(state, state.eldest);
    state.message = `Bids in: ${state.bids.map((b, i) => `${PLAYER_LABELS[i]} ${b}`).join(", ")}.`;
  } else {
    state.currentTurn = nextSeat(seat);
    state.message =
      state.currentTurn === 0
        ? "Your bid — how many tricks will you take?"
        : `${PLAYER_LABELS[state.currentTurn]} is bidding…`;
  }
  return true;
}

/** Exact bid scores 10 + bid; a miss scores nothing. Match ends at hand 10. */
export function endOhHellHand(ctx: ModeCtx): void {
  const { state } = ctx;
  const madeIt: PlayerIndex[] = [];
  for (let seat = 0; seat < 4; seat++) {
    const bid = state.bids[seat]!;
    if (state.trickCounts[seat] === bid) {
      state.scores[seat]! += 10 + bid;
      madeIt.push(seat as PlayerIndex);
    }
  }

  if (state.handNumber >= OH_HELL_MAX_HANDS) {
    const top = Math.max(...state.scores);
    const leaders = ([0, 1, 2, 3] as PlayerIndex[]).filter(
      (s) => state.scores[s] === top,
    );
    state.phase = "GAME_OVER";
    state.winner = leaders.includes(0) ? "player" : "computer";
    state.message =
      leaders.length > 1
        ? `Shared win — ${leaders.map((s) => PLAYER_LABELS[s]).join(" and ")} tie at ${top}.`
        : `${leaders[0] === 0 ? "You win" : `${PLAYER_LABELS[leaders[0]!]} wins`} with ${top} points!`;
    return;
  }

  state.phase = "HAND_OVER";
  state.message =
    madeIt.length > 0
      ? `Made it: ${madeIt.map((s) => PLAYER_LABELS[s]).join(", ")}.`
      : "Nobody made their bid.";
}
