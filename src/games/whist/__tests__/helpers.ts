import { WhistGame } from "../game";
import type { WhistState } from "../types";
import { cardKey } from "../../../shared/deck";

export function autoGame(preset: string | undefined, seed: number): WhistGame {
  const game = new WhistGame(preset, seed);
  game.autoPilot = true;
  return game;
}

/**
 * Drive a bot-only game (dealing through PRE_DEAL / HAND_OVER) until `done`,
 * throwing if the game stalls or the step budget runs out.
 */
export function stepUntil(
  game: WhistGame,
  done: (s: Readonly<WhistState>) => boolean,
  budget = 6000,
  onStep?: (s: Readonly<WhistState>) => void,
): void {
  let steps = 0;
  while (!done(game.getState()) && steps < budget) {
    const s = game.getState();
    if (s.phase === "PRE_DEAL" || s.phase === "HAND_OVER") {
      game.deal();
    } else if (!game.botStep()) {
      throw new Error(`Game stalled in phase ${s.phase}`);
    }
    onStep?.(game.getState());
    steps++;
  }
  if (!done(game.getState())) {
    throw new Error(`Step budget (${budget}) exhausted`);
  }
}

/** Every card in the live hand: hands, trick plays, stock, and turned card. */
export function allCardKeys(s: Readonly<WhistState>): string[] {
  const cards = [
    ...s.hands.flat(),
    ...(s.currentTrick?.plays.map((p) => p.card) ?? []),
    ...s.completedTricks.flatMap((t) => t.plays.map((p) => p.card)),
    ...s.stock,
  ];
  if (s.trumpCard && !s.trumpCardInHand) cards.push(s.trumpCard);
  return cards.map(cardKey);
}
