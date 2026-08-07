import { Suit, type PlayingCard } from "typedeck";
import { createDeck, shuffle } from "../../../shared/deck";
import {
  type MichiganState,
  type ModeCtx,
  type PlayerIndex,
  PLAYER_LABELS,
  cardLabel,
  isRedSuit,
  michRank,
  nextSeat,
  orderLabel,
  sortHand,
} from "../types";

const ACE_ORDER = 14;

function label(seat: PlayerIndex): string {
  return PLAYER_LABELS[seat];
}

/** Ante onto the boodle layout, then deal 5 piles (4 seats + widow). */
export function dealMichigan(ctx: ModeCtx): void {
  const { state, cfg } = ctx;
  for (const slot of state.boodle) {
    for (let p = 0 as PlayerIndex; p < 4; p = (p + 1) as PlayerIndex) {
      const ante = (p === state.dealer ? 2 : 1) * cfg.boodleAnte;
      state.chips[p]! -= ante;
      slot.chips += ante;
    }
  }

  const deck = shuffle(createDeck(), ctx.rng);
  const piles: PlayingCard[][] = [[], [], [], [], []];
  deck.forEach((c, i) => piles[i % 5]!.push(c));

  const eldest = nextSeat(state.dealer);
  for (let i = 0; i < 4; i++) {
    const seat = ((eldest + i) % 4) as PlayerIndex;
    state.hands[seat] = piles[i]!;
    sortHand(state.hands[seat]!, true);
  }
  state.deadHand = piles[4]!;

  state.phase = "DEALER_SWAP";
  state.currentTurn = state.dealer;
  state.message = `${label(state.dealer)} (dealer) may swap for the widow, sight unseen.`;
}

/** Swap heuristic: trade a hand holding fewer than two cards ranked 9 or higher. */
export function shouldBotSwap(hand: readonly PlayingCard[]): boolean {
  return hand.filter((c) => michRank(c) >= 9).length < 2;
}

export function resolveDealerSwap(ctx: ModeCtx, swap: boolean): void {
  const { state } = ctx;
  if (swap) {
    const old = state.hands[state.dealer]!;
    state.hands[state.dealer] = state.deadHand;
    state.deadHand = old;
    sortHand(state.hands[state.dealer]!, true);
  }
  const eldest = nextSeat(state.dealer);
  state.prevSuit = null;
  state.sequence = null;
  state.phase = "AWAIT_LEAD";
  state.currentTurn = eldest;
  state.message = `${label(state.dealer)} ${swap ? "took the widow" : "kept the hand"}. ${label(eldest)} lead${eldest === 0 ? "" : "s"} first.`;
}

/**
 * Suits the leader may open: opposite-color suits first, then any different
 * suit, then (only if nothing else is held) the same suit again.
 */
export function eligibleLeadSuits(
  hand: readonly PlayingCard[],
  prevSuit: Suit | null,
): Suit[] {
  const held = [...new Set(hand.map((c) => c.suit))];
  if (prevSuit === null) return held;
  const opposite = held.filter((s) => isRedSuit(s) !== isRedSuit(prevSuit));
  if (opposite.length > 0) return opposite;
  const different = held.filter((s) => s !== prevSuit);
  if (different.length > 0) return different;
  return held;
}

function lowestIndexOfSuit(hand: readonly PlayingCard[], suit: Suit): number {
  let best = -1;
  for (let i = 0; i < hand.length; i++) {
    const c = hand[i]!;
    if (c.suit !== suit) continue;
    if (best < 0 || michRank(c) < michRank(hand[best]!)) best = i;
  }
  return best;
}

/** Leadable indices: the lowest card of each eligible suit. */
export function michiganLeadIndices(
  state: MichiganState,
  seat: PlayerIndex,
): number[] {
  const hand = state.hands[seat]!;
  return eligibleLeadSuits(hand, state.prevSuit).map((s) =>
    lowestIndexOfSuit(hand, s),
  );
}

/** Index of the card the running sequence demands from `seat`, or -1. */
export function requiredIndexMich(
  state: MichiganState,
  seat: PlayerIndex,
): number {
  const seq = state.sequence;
  if (!seq) return -1;
  return state.hands[seat]!.findIndex(
    (c) => c.suit === seq.suit && michRank(c) === seq.nextOrder,
  );
}

function holderOfNext(state: MichiganState): PlayerIndex | null {
  const seq = state.sequence!;
  for (let p = 0 as PlayerIndex; p < 4; p = (p + 1) as PlayerIndex) {
    if (requiredIndexMich(state, p) >= 0) return p;
  }
  return null;
}

export function michiganPlay(
  ctx: ModeCtx,
  seat: PlayerIndex,
  index: number,
): boolean {
  const { state } = ctx;
  if (state.currentTurn !== seat) return false;

  if (state.phase === "AWAIT_LEAD") {
    if (!michiganLeadIndices(state, seat).includes(index)) return false;
    const card = state.hands[seat]!.splice(index, 1)[0]!;
    state.played.push(card);
    state.sequence = {
      suit: card.suit,
      nextOrder: michRank(card) + 1,
      lastPlayer: seat,
      playedCount: 1,
      cards: [card],
    };
    afterPlay(ctx, seat, card);
    return true;
  }

  if (state.phase === "AWAIT_PLAY") {
    if (index < 0 || index !== requiredIndexMich(state, seat)) return false;
    const card = state.hands[seat]!.splice(index, 1)[0]!;
    state.played.push(card);
    const seq = state.sequence!;
    seq.nextOrder += 1;
    seq.lastPlayer = seat;
    seq.playedCount += 1;
    seq.cards.push(card);
    afterPlay(ctx, seat, card);
    return true;
  }

  return false;
}

function afterPlay(ctx: ModeCtx, seat: PlayerIndex, card: PlayingCard): void {
  const { state } = ctx;
  const won = collectBoodle(state, seat, card);
  if (state.hands[seat]!.length === 0) {
    ctx.endHand(seat);
  } else {
    advance(ctx);
  }
  if (won > 0) {
    state.message = `${label(seat)} collected ${won} chips from the ${cardLabel(card)} boodle! ${state.message}`;
  }
}

function collectBoodle(
  state: MichiganState,
  seat: PlayerIndex,
  card: PlayingCard,
): number {
  const slot = state.boodle.find(
    (b) => b.cardName === card.cardName && b.suit === card.suit,
  );
  if (!slot || slot.chips === 0) return 0;
  const won = slot.chips;
  slot.chips = 0;
  state.chips[seat]! += won;
  return won;
}

function advance(ctx: ModeCtx): void {
  const { state } = ctx;
  const seq = state.sequence!;
  if (seq.nextOrder <= ACE_ORDER) {
    const holder = holderOfNext(state);
    if (holder !== null) {
      state.phase = "AWAIT_PLAY";
      state.currentTurn = holder;
      state.message =
        holder === 0
          ? `You hold the ${orderLabel(seq.nextOrder)} — play it to continue.`
          : `${label(holder)} plays the ${orderLabel(seq.nextOrder)}…`;
      return;
    }
  }

  const stopped = seq.nextOrder <= ACE_ORDER;
  const leader = seq.lastPlayer;
  state.prevSuit = seq.suit;
  state.sequence = null;
  state.phase = "AWAIT_LEAD";
  state.currentTurn = leader;
  state.message = `${stopped ? "Stop!" : "Ace ends the run."} ${label(leader)} lead${leader === 0 ? "" : "s"} a new suit.`;
}

export function michiganBotAct(ctx: ModeCtx, seat: PlayerIndex): void {
  const { state } = ctx;
  if (state.phase === "AWAIT_LEAD") {
    const hand = state.hands[seat]!;
    const suits = eligibleLeadSuits(hand, state.prevSuit);
    let best = suits[0]!;
    let bestCount = -1;
    for (const s of suits) {
      const count = hand.filter((c) => c.suit === s).length;
      if (count > bestCount) {
        bestCount = count;
        best = s;
      }
    }
    michiganPlay(ctx, seat, lowestIndexOfSuit(hand, best));
  } else if (state.phase === "AWAIT_PLAY") {
    michiganPlay(ctx, seat, requiredIndexMich(state, seat));
  }
}
