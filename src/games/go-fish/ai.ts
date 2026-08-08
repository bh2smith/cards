import type { CardName, PlayingCard } from "typedeck";

function pick<T>(pool: readonly T[], rng: () => number): T {
  return pool[Math.floor(rng() * pool.length)]!;
}

/**
 * Choose which rank the bot asks for. The bot only ever asks for ranks it
 * holds. It prefers a rank the player is believed to hold (because the player
 * asked for it and hasn't given those cards up or booked them since), falling
 * back to its own most-held rank. Ties are broken randomly via `rng`.
 */
export function chooseAsk(
  botHand: readonly PlayingCard[],
  beliefs: ReadonlySet<CardName>,
  rng: () => number = Math.random,
): CardName {
  if (botHand.length === 0) throw new Error("Bot hand is empty");

  const counts = new Map<CardName, number>();
  for (const card of botHand) {
    counts.set(card.cardName, (counts.get(card.cardName) ?? 0) + 1);
  }

  const remembered = [...counts.keys()].filter((rank) => beliefs.has(rank));
  if (remembered.length > 0) return pick(remembered, rng);

  let max = 0;
  for (const n of counts.values()) if (n > max) max = n;
  const mostHeld = [...counts.entries()]
    .filter(([, n]) => n === max)
    .map(([rank]) => rank);
  return pick(mostHeld, rng);
}
