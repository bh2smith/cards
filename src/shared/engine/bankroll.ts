const BALANCE_KEY = "cardroom:bankroll";
const TOPUP_KEY = "cardroom:bankroll-topup";

export const STARTING_CHIPS = 200;
export const DAILY_TOPUP = 100;

// In-memory fallback so pure-logic tests run outside the browser.
let memBalance: number | null = null;
let memTopup: string | null = null;

function hasStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function readBalance(): number | null {
  const raw = hasStorage() ? localStorage.getItem(BALANCE_KEY) : memBalance;
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function writeBalance(n: number): void {
  if (hasStorage()) localStorage.setItem(BALANCE_KEY, String(n));
  else memBalance = n;
}

function readTopupDay(): string | null {
  return hasStorage() ? localStorage.getItem(TOPUP_KEY) : memTopup;
}

function writeTopupDay(day: string): void {
  if (hasStorage()) localStorage.setItem(TOPUP_KEY, day);
  else memTopup = day;
}

/**
 * The play-money chip balance, seeding new players and topping broke ones
 * back up to DAILY_TOPUP once per calendar day so nobody is ever locked out.
 */
export function getBankroll(now = new Date()): number {
  let balance = readBalance();
  if (balance === null) {
    balance = STARTING_CHIPS;
    writeBalance(balance);
  }
  const today = now.toISOString().slice(0, 10);
  if (balance < DAILY_TOPUP && readTopupDay() !== today) {
    balance = DAILY_TOPUP;
    writeBalance(balance);
    writeTopupDay(today);
  }
  return balance;
}

/** Apply a win (+) or loss (−); the balance never goes below zero. */
export function adjustBankroll(delta: number): number {
  const next = Math.max(0, getBankroll() + delta);
  writeBalance(next);
  return next;
}

/** Test hook: reset the in-memory fallback between cases. */
export function resetBankrollForTests(): void {
  memBalance = null;
  memTopup = null;
  if (hasStorage()) {
    localStorage.removeItem(BALANCE_KEY);
    localStorage.removeItem(TOPUP_KEY);
  }
}
