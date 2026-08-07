import { type Suit } from "typedeck";
import { cardOrder } from "../../../shared/deck";
import {
  type MichiganState,
  type ModeCtx,
  type PlayerIndex,
  PLAYER_LABELS,
  dealFourHands,
  nextSeat,
  orderLabel,
} from "../types";

const SUIT_SIZE = 13;

function label(seat: PlayerIndex): string {
  return PLAYER_LABELS[seat];
}

/** Round-the-corner successor: …Q, K, A, 2, 3… */
export function wrapNext(order: number): number {
  return order === 13 ? 1 : order + 1;
}

export function dealPlayOrPay(ctx: ModeCtx): void {
  const { state, cfg } = ctx;
  for (let p = 0; p < 4; p++) {
    state.chips[p]! -= cfg.potAnte;
    state.pot += cfg.potAnte;
  }
  dealFourHands(ctx, false);
  state.startedSuits = [];
  state.sequence = null;
  state.phase = "AWAIT_LEAD";
  state.currentTurn = nextSeat(state.dealer);
  state.message = `${label(state.currentTurn)} lead${state.currentTurn === 0 ? "" : "s"} any card.`;
}

/** Leadable indices: any card of a suit whose sequence has not been started. */
export function popLeadIndices(
  state: MichiganState,
  seat: PlayerIndex,
): number[] {
  const out: number[] = [];
  state.hands[seat]!.forEach((c, i) => {
    if (!state.startedSuits.includes(c.suit)) out.push(i);
  });
  return out;
}

/** Index of the forced card for `seat`, or -1 when they must pay. */
export function popRequiredIndex(
  state: MichiganState,
  seat: PlayerIndex,
): number {
  const seq = state.sequence;
  if (!seq) return -1;
  return state.hands[seat]!.findIndex(
    (c) => c.suit === seq.suit && cardOrder(c) === seq.nextOrder,
  );
}

export function popPlay(
  ctx: ModeCtx,
  seat: PlayerIndex,
  index: number,
): boolean {
  const { state } = ctx;
  if (state.currentTurn !== seat) return false;

  if (state.phase === "AWAIT_LEAD") {
    if (!popLeadIndices(state, seat).includes(index)) return false;
    const card = state.hands[seat]!.splice(index, 1)[0]!;
    state.played.push(card);
    state.startedSuits.push(card.suit);
    state.sequence = {
      suit: card.suit,
      nextOrder: wrapNext(cardOrder(card)),
      lastPlayer: seat,
      playedCount: 1,
      cards: [card],
    };
    if (state.hands[seat]!.length === 0) {
      ctx.endHand(seat);
      return true;
    }
    advance(ctx);
    return true;
  }

  if (state.phase === "AWAIT_FORCED") {
    if (index < 0 || index !== popRequiredIndex(state, seat)) return false;
    const card = state.hands[seat]!.splice(index, 1)[0]!;
    state.played.push(card);
    const seq = state.sequence!;
    seq.nextOrder = wrapNext(seq.nextOrder);
    seq.lastPlayer = seat;
    seq.playedCount += 1;
    seq.cards.push(card);
    if (state.hands[seat]!.length === 0) {
      ctx.endHand(seat);
      return true;
    }
    advance(ctx);
    return true;
  }

  return false;
}

/** Pay one chip to the pot when the forced card is not in hand. */
export function popPay(ctx: ModeCtx, seat: PlayerIndex): boolean {
  const { state } = ctx;
  if (state.phase !== "AWAIT_FORCED" || state.currentTurn !== seat)
    return false;
  if (popRequiredIndex(state, seat) >= 0) return false;
  state.chips[seat]! -= 1;
  state.pot += 1;
  state.currentTurn = nextSeat(seat);
  state.message = `${label(seat)} lack${seat === 0 ? "" : "s"} the ${orderLabel(state.sequence!.nextOrder)} — paid 1 chip.`;
  return true;
}

function advance(ctx: ModeCtx): void {
  const { state } = ctx;
  const seq = state.sequence!;
  if (seq.playedCount === SUIT_SIZE) {
    const leader = seq.lastPlayer;
    state.sequence = null;
    state.phase = "AWAIT_LEAD";
    state.currentTurn = leader;
    state.message = `Suit complete — ${label(leader)} lead${leader === 0 ? "" : "s"} a new suit.`;
    return;
  }
  state.phase = "AWAIT_FORCED";
  state.currentTurn = nextSeat(state.currentTurn);
  state.message =
    state.currentTurn === 0
      ? `Play the ${orderLabel(seq.nextOrder)} or pay 1 chip.`
      : `${label(state.currentTurn)} needs the ${orderLabel(seq.nextOrder)}…`;
}

export function popBotAct(ctx: ModeCtx, seat: PlayerIndex): void {
  const { state } = ctx;
  if (state.phase === "AWAIT_LEAD") {
    const hand = state.hands[seat]!;
    const counts = new Map<Suit, number>();
    for (const c of hand) {
      if (state.startedSuits.includes(c.suit)) continue;
      counts.set(c.suit, (counts.get(c.suit) ?? 0) + 1);
    }
    let bestSuit: Suit | null = null;
    let bestCount = -1;
    for (const [suit, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestSuit = suit;
      }
    }
    let bestIndex = -1;
    hand.forEach((c, i) => {
      if (c.suit !== bestSuit) return;
      if (bestIndex < 0 || cardOrder(c) < cardOrder(hand[bestIndex]!))
        bestIndex = i;
    });
    popPlay(ctx, seat, bestIndex);
    return;
  }
  if (state.phase === "AWAIT_FORCED") {
    const req = popRequiredIndex(state, seat);
    if (req >= 0) popPlay(ctx, seat, req);
    else popPay(ctx, seat);
  }
}
