import { onAppData } from "@aboutcircles/miniapp-sdk";

/**
 * A solitaire challenge: replay the exact deal someone else played and
 * finish with fewer cards remaining. Travels as a base64url payload in the
 * `?data=` query param, which the Circles miniapp host forwards via
 * onAppData and which the app also reads directly when opened standalone.
 */
export interface Challenge {
  /** Route id of the game ("golf" | "pyramid" | "klondike" | "freecell"). */
  game: string;
  /** Deal seed — mulberry32 seed, or the Freecell deal number. */
  seed: number;
  /** The challenger's result; fewer is better, 0 means they cleared it. */
  cardsRemaining: number;
  /** Challenger's wallet address, when known. */
  by?: string;
}

export const CHALLENGE_GAMES = new Set([
  "golf",
  "pyramid",
  "klondike",
  "freecell",
]);

export function encodeChallenge(c: Challenge): string {
  const payload: Record<string, unknown> = {
    v: 1,
    g: c.game,
    s: c.seed,
    c: c.cardsRemaining,
  };
  if (c.by) payload.b = c.by;
  return btoa(JSON.stringify(payload))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function decodeChallenge(raw: string): Challenge | null {
  try {
    const json = atob(raw.replaceAll("-", "+").replaceAll("_", "/"));
    const data = JSON.parse(json);
    if (typeof data.g !== "string" || !CHALLENGE_GAMES.has(data.g)) return null;
    if (!Number.isInteger(data.s) || data.s < 0 || data.s > 0xffffffff)
      return null;
    if (!Number.isInteger(data.c) || data.c < 0 || data.c > 52) return null;

    const challenge: Challenge = {
      game: data.g,
      seed: data.s,
      cardsRemaining: data.c,
    };
    if (typeof data.b === "string" && /^0x[0-9a-fA-F]{40}$/.test(data.b)) {
      challenge.by = data.b;
    }
    return challenge;
  } catch {
    return null;
  }
}

export function challengeUrl(c: Challenge): string {
  return `${location.origin}${location.pathname}?data=${encodeChallenge(c)}#/${c.game}`;
}

let pending: Challenge | null = null;

function accept(raw: string): void {
  const challenge = decodeChallenge(raw);
  if (!challenge) return;
  pending = challenge;
  if (location.hash !== `#/${challenge.game}`) {
    location.hash = `/${challenge.game}`;
  }
}

/**
 * Wire up challenge intake. Call once at startup, before the router runs,
 * so a challenge URL lands directly on the right game.
 */
export function initChallenges(): void {
  const raw = new URLSearchParams(location.search).get("data");
  if (raw) accept(raw);
  onAppData(accept);
}

/**
 * Claim the pending challenge for a game. Single-shot: a replay or a fresh
 * visit to the same game afterwards deals randomly again.
 */
export function consumeChallenge(game: string): Challenge | null {
  if (pending?.game !== game) return null;
  const challenge = pending;
  pending = null;
  return challenge;
}
