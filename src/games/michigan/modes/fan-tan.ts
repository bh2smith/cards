import { CardName, type PlayingCard } from "typedeck";
import { cardOrder } from "../../../shared/deck";
import {
  type MichiganState,
  type ModeCtx,
  type PlayerIndex,
  PLAYER_LABELS,
  cardLabel,
  dealFourHands,
  emptyRows,
  nextSeat,
} from "../types";

function label(seat: PlayerIndex): string {
  return PLAYER_LABELS[seat];
}

export function dealFanTan(ctx: ModeCtx): void {
  const { state, cfg } = ctx;
  for (let p = 0; p < 4; p++) {
    state.chips[p]! -= cfg.potAnte;
    state.pot += cfg.potAnte;
  }
  dealFourHands(ctx, false);
  state.rows = emptyRows();
  state.phase = "AWAIT_PLAY";
  state.currentTurn = nextSeat(state.dealer);
  state.message = `${label(state.currentTurn)} start${state.currentTurn === 0 ? "" : "s"} — sevens open a suit.`;
}

/** Legal indices: any Seven, or a card adjacent to its suit's open row. */
export function fanTanLegalIndices(
  state: MichiganState,
  seat: PlayerIndex,
): number[] {
  const out: number[] = [];
  state.hands[seat]!.forEach((c, i) => {
    if (c.cardName === CardName.Seven) {
      out.push(i);
      return;
    }
    const row = state.rows[c.suit]!;
    if (row.low === null) return;
    const o = cardOrder(c);
    if (o === row.high! + 1 || o === row.low - 1) out.push(i);
  });
  return out;
}

export function fanTanPlay(
  ctx: ModeCtx,
  seat: PlayerIndex,
  index: number,
): boolean {
  const { state } = ctx;
  if (state.phase !== "AWAIT_PLAY" || state.currentTurn !== seat) return false;
  if (!fanTanLegalIndices(state, seat).includes(index)) return false;

  const card = state.hands[seat]!.splice(index, 1)[0]!;
  state.played.push(card);
  const row = state.rows[card.suit]!;
  const o = cardOrder(card);
  if (card.cardName === CardName.Seven) {
    row.low = 7;
    row.high = 7;
  } else if (o === row.high! + 1) {
    row.high = o;
  } else {
    row.low = o;
  }

  if (state.hands[seat]!.length === 0) {
    ctx.endHand(seat);
    return true;
  }
  state.currentTurn = nextSeat(seat);
  state.message = `${label(seat)} played ${cardLabel(card)}. ${turnHint(state)}`;
  return true;
}

/** Pay one chip to the pot and pass — only legal with no playable card. */
export function fanTanPass(ctx: ModeCtx, seat: PlayerIndex): boolean {
  const { state } = ctx;
  if (state.phase !== "AWAIT_PLAY" || state.currentTurn !== seat) return false;
  if (fanTanLegalIndices(state, seat).length > 0) return false;
  state.chips[seat]! -= 1;
  state.pot += 1;
  state.currentTurn = nextSeat(seat);
  state.message = `${label(seat)} paid 1 chip to the pot. ${turnHint(state)}`;
  return true;
}

function turnHint(state: MichiganState): string {
  return state.currentTurn === 0
    ? "Your turn."
    : `${label(state.currentTurn)}'s turn…`;
}

/** Does playing `card` open a slot the same hand can immediately fill? */
function unlocksOwn(
  state: MichiganState,
  hand: readonly PlayingCard[],
  card: PlayingCard,
): boolean {
  const o = cardOrder(card);
  const holds = (ord: number) =>
    hand.some(
      (h) => h !== card && h.suit === card.suit && cardOrder(h) === ord,
    );
  if (card.cardName === CardName.Seven) return holds(6) || holds(8);
  const row = state.rows[card.suit]!;
  if (row.high !== null && o === row.high + 1) return holds(o + 1);
  return holds(o - 1);
}

export function fanTanBotAct(ctx: ModeCtx, seat: PlayerIndex): void {
  const { state } = ctx;
  const legal = fanTanLegalIndices(state, seat);
  if (legal.length === 0) {
    fanTanPass(ctx, seat);
    return;
  }
  const hand = state.hands[seat]!;
  const preferred = legal.filter((i) => unlocksOwn(state, hand, hand[i]!));
  const pool = preferred.length > 0 ? preferred : legal;
  fanTanPlay(ctx, seat, pool[Math.floor(ctx.rng() * pool.length)]!);
}
