import { adjustBankroll, getBankroll } from "./bankroll";

/**
 * House-wager tier for banking games: stake comes off the persistent
 * play-money bankroll when placed; settle() credits the full return
 * (stake included for a win, zero for a loss, stake alone for a push).
 */
export interface Wager {
  readonly amount: number;
  /** Credit the given return and close the wager. Returns the new balance. */
  settle(returned: number): number;
}

export function balance(): number {
  return getBankroll();
}

/** Standard bet steps for a given balance, largest first capped at balance. */
export function betOptions(bal: number): number[] {
  const steps = [1, 5, 10, 25, 50, 100];
  const options = steps.filter((s) => s <= bal);
  return options.length > 0 ? options : [];
}

/**
 * Deduct the stake and return a settleable wager, or null when the
 * balance can't cover it. A wager may be settled exactly once.
 */
export function placeWager(amount: number): Wager | null {
  if (amount <= 0 || amount > getBankroll()) return null;
  adjustBankroll(-amount);
  let settled = false;
  return {
    amount,
    settle(returned: number): number {
      if (settled) throw new Error("Wager already settled");
      settled = true;
      return returned > 0 ? adjustBankroll(returned) : getBankroll();
    },
  };
}

/** Convenience returns for common outcomes. */
export function winReturn(stake: number, multiplier: number): number {
  return stake + Math.floor(stake * multiplier);
}
export function pushReturn(stake: number): number {
  return stake;
}
