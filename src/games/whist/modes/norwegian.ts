import { createDeck, shuffle } from "../../../shared/deck";
import {
  type HandType,
  type ModeCtx,
  type PlayerIndex,
  type Team,
  PLAYER_LABELS,
  nextSeat,
  seatOrderFromEldest,
  sortWhistHand,
  startPlaying,
  teamOf,
} from "../types";

/**
 * Norwegian whist: partnership, never any trump. Starting with eldest, each
 * player may declare grand (win tricks) or nullo (lose them); the first
 * declaration fixes the hand. All four passing means nullo.
 */
export function dealNorwegian(ctx: ModeCtx): void {
  const { state } = ctx;
  const deck = shuffle(createDeck(), ctx.rng);
  const order = seatOrderFromEldest(state);
  order.forEach((seat, i) => {
    state.hands[seat] = deck.slice(i * 13, (i + 1) * 13);
  });
  state.handSize = 13;
  for (const hand of state.hands) sortWhistHand(hand, null);

  state.phase = "DECLARING";
  state.currentTurn = state.eldest;
  state.message =
    state.currentTurn === 0
      ? "Declare grand, nullo, or pass."
      : `${PLAYER_LABELS[state.currentTurn]} is declaring…`;
}

export function norwegianDeclare(
  ctx: ModeCtx,
  seat: PlayerIndex,
  choice: HandType | "pass",
): boolean {
  const { state } = ctx;
  if (state.phase !== "DECLARING" || state.currentTurn !== seat) return false;

  if (choice !== "pass") {
    state.handType = choice;
    state.declarer = seat;
    startPlaying(state, state.eldest);
    state.message = `${seat === 0 ? "You declare" : `${PLAYER_LABELS[seat]} declares`} ${choice} — no trump, ace high.`;
    return true;
  }

  if (seat === state.dealer) {
    // All four passed: the hand is played nullo with no declarer.
    state.handType = "nullo";
    state.declarer = null;
    startPlaying(state, state.eldest);
    state.message = "All pass — the hand is played nullo.";
    return true;
  }

  state.currentTurn = nextSeat(seat);
  state.message =
    state.currentTurn === 0
      ? "Declare grand, nullo, or pass."
      : `${PLAYER_LABELS[state.currentTurn]} is declaring…`;
  return true;
}

/**
 * Points per odd trick above six. Grand: the side taking them scores 4 if it
 * declared, 8 if it defended. Nullo: each odd trick scores 2 against the side
 * taking it (the other side gains).
 */
export function norwegianHandPoints(
  t0: number,
  t1: number,
  handType: HandType,
  declTeam: Team | null,
): [number, number] {
  const taking: Team = t0 > t1 ? 0 : 1;
  const odd = Math.max(t0, t1) - 6;
  const points: [number, number] = [0, 0];
  if (handType === "grand") {
    points[taking] = odd * (declTeam === taking ? 4 : 8);
  } else {
    points[taking === 0 ? 1 : 0] = odd * 2;
  }
  return points;
}

export function endNorwegianHand(ctx: ModeCtx): void {
  const { state } = ctx;
  const t0 = state.trickCounts[0]! + state.trickCounts[2]!;
  const t1 = state.trickCounts[1]! + state.trickCounts[3]!;
  const declTeam = state.declarer === null ? null : teamOf(state.declarer);
  const [p0, p1] = norwegianHandPoints(t0, t1, state.handType!, declTeam);
  state.teamScores[0] += p0;
  state.teamScores[1] += p1;

  const target = ctx.cfg.targetScore ?? 50;
  const leadTeam: Team = state.teamScores[0] >= state.teamScores[1] ? 0 : 1;
  if (state.teamScores[leadTeam] >= target) {
    state.phase = "GAME_OVER";
    state.winner = leadTeam === 0 ? "player" : "computer";
    state.message = `${leadTeam === 0 ? "Your side wins" : "Left & Right win"} ${state.teamScores[leadTeam]}–${state.teamScores[1 - leadTeam]}!`;
    return;
  }

  state.phase = "HAND_OVER";
  const gain = p0 > 0 ? `Your side +${p0}` : `Left & Right +${p1}`;
  state.message = `${state.handType === "grand" ? "Grand" : "Nullo"} hand: ${t0}–${t1} tricks. ${gain}.`;
}
