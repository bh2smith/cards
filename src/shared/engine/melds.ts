import type { PlayingCard } from "typedeck";
import { cardOrder, cardKey } from "../deck";

export interface Meld {
  type: "set" | "run";
  cards: PlayingCard[];
}

export interface RunOptions {
  /** Minimum run length (default 3). */
  minLength?: number;
  /** Allow the ace to sit above the king (Q-K-A). */
  aceHigh?: boolean;
  /** Allow runs to wrap K-A-2. Implies ace adjacency on both sides. */
  roundTheCorner?: boolean;
}

/** All sets (3 or 4 of a rank, plus every 3-card subset of a 4). */
export function findAllSets(hand: PlayingCard[]): Meld[] {
  const byRank = new Map<number, PlayingCard[]>();
  for (const c of hand) {
    const r = c.cardName;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(c);
  }

  const melds: Meld[] = [];
  for (const group of byRank.values()) {
    if (group.length >= 4) {
      melds.push({ type: "set", cards: [...group] });
      for (let skip = 0; skip < group.length; skip++) {
        melds.push({
          type: "set",
          cards: group.filter((_, i) => i !== skip),
        });
      }
    } else if (group.length === 3) {
      melds.push({ type: "set", cards: [...group] });
    }
  }
  return melds;
}

/** All runs of `minLength`+ within each suit, honoring ace and wrap options. */
export function findAllRuns(
  hand: PlayingCard[],
  options: RunOptions = {},
): Meld[] {
  const minLength = options.minLength ?? 3;
  const bySuit = new Map<number, Map<number, PlayingCard>>();
  for (const c of hand) {
    if (!bySuit.has(c.suit)) bySuit.set(c.suit, new Map());
    const suitMap = bySuit.get(c.suit)!;
    const order = cardOrder(c);
    if (!suitMap.has(order)) suitMap.set(order, c);
  }

  const melds: Meld[] = [];
  for (const suitMap of bySuit.values()) {
    // Linear pass over orders 1..14, where 14 is the ace again when aceHigh.
    const orders = [...suitMap.keys()].sort((a, b) => a - b);
    const linear = [...orders];
    if ((options.aceHigh || options.roundTheCorner) && suitMap.has(1)) {
      linear.push(14);
    }

    let start = 0;
    while (start < linear.length) {
      let end = start;
      while (end + 1 < linear.length && linear[end + 1]! === linear[end]! + 1) {
        end++;
      }
      const seqLen = end - start + 1;
      for (let len = minLength; len <= seqLen; len++) {
        for (let i = start; i + len - 1 <= end; i++) {
          melds.push({
            type: "run",
            cards: linear
              .slice(i, i + len)
              .map((o) => suitMap.get(o === 14 ? 1 : o)!),
          });
        }
      }
      start = end + 1;
    }

    // Wrapping pass: only windows that cross the K→A boundary, so nothing
    // the linear pass already produced is duplicated.
    if (options.roundTheCorner) {
      const present = new Set(orders);
      for (let len = minLength; len <= 13; len++) {
        for (let startOrder = 1; startOrder <= 13; startOrder++) {
          if (startOrder + len - 1 <= 13) continue; // no wrap — linear covered it
          const window: number[] = [];
          for (let k = 0; k < len; k++) {
            window.push(((startOrder - 1 + k) % 13) + 1);
          }
          // Skip windows equivalent to the aceHigh linear extension (…K,A).
          if (window[window.length - 1]! === 1 && window.length <= 13) {
            const withoutWrapPastAce = window.indexOf(1) === window.length - 1;
            if (withoutWrapPastAce) continue; // handled by linear pass via 14
          }
          if (window.every((o) => present.has(o))) {
            melds.push({
              type: "run",
              cards: window.map((o) => suitMap.get(o)!),
            });
          }
        }
      }
    }
  }
  return melds;
}

/**
 * The meld partition minimizing leftover value ("deadwood") via backtracking
 * over all candidate melds. Exponential in melds, fine for rummy hand sizes.
 */
export function findBestMelds(
  hand: PlayingCard[],
  cardValue: (card: PlayingCard) => number,
  options: RunOptions = {},
): { melds: Meld[]; deadwood: PlayingCard[] } {
  const allMelds = [...findAllSets(hand), ...findAllRuns(hand, options)];

  let bestDeadwoodValue = Infinity;
  let bestMelds: Meld[] = [];

  function backtrack(idx: number, used: Set<string>, chosen: Meld[]) {
    const usedCards = new Set(used);
    const dw = hand.filter((c) => !usedCards.has(cardKey(c)));
    const dwVal = dw.reduce((sum, c) => sum + cardValue(c), 0);

    if (dwVal < bestDeadwoodValue) {
      bestDeadwoodValue = dwVal;
      bestMelds = [...chosen];
    }

    if (dwVal === 0) return;

    for (let i = idx; i < allMelds.length; i++) {
      const meld = allMelds[i]!;
      const keys = meld.cards.map(cardKey);
      if (keys.some((k) => used.has(k))) continue;

      for (const k of keys) used.add(k);
      chosen.push(meld);
      backtrack(i + 1, used, chosen);
      chosen.pop();
      for (const k of keys) used.delete(k);
    }
  }

  backtrack(0, new Set(), []);

  const usedKeys = new Set<string>();
  for (const m of bestMelds) {
    for (const c of m.cards) usedKeys.add(cardKey(c));
  }

  return {
    melds: bestMelds,
    deadwood: hand.filter((c) => !usedKeys.has(cardKey(c))),
  };
}

export function deadwoodValue(
  cards: PlayingCard[],
  cardValue: (card: PlayingCard) => number,
): number {
  return cards.reduce((sum, c) => sum + cardValue(c), 0);
}

/**
 * Greedily extend the knocker's melds with the defender's deadwood (sets grow
 * to 4; runs extend at either end, honoring ace/wrap options). Iterates to a
 * fixed point so a layoff can enable another.
 */
export function findLayoffs(
  defenderDeadwood: PlayingCard[],
  knockerMelds: Meld[],
  options: RunOptions = {},
): PlayingCard[] {
  const layoffs: PlayingCard[] = [];
  const remaining = [...defenderDeadwood];
  const melds = knockerMelds.map((m) => ({ ...m, cards: [...m.cards] }));

  const adjacent = (a: number, b: number): boolean => {
    if (b === a + 1 || b === a - 1) return true;
    if (options.aceHigh || options.roundTheCorner) {
      if ((a === 13 && b === 1) || (a === 1 && b === 13)) return true;
    }
    return false;
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const card = remaining[i]!;
      for (const meld of melds) {
        if (meld.type === "set") {
          if (
            meld.cards.length < 4 &&
            card.cardName === meld.cards[0]!.cardName
          ) {
            meld.cards.push(card);
            layoffs.push(card);
            remaining.splice(i, 1);
            changed = true;
            break;
          }
        } else {
          if (card.suit !== meld.cards[0]!.suit) continue;
          if (meld.cards.length >= 13) continue;
          const orders = meld.cards.map(cardOrder);
          const ends = [orders[0]!, orders[orders.length - 1]!];
          const inMeld = new Set(orders);
          if (
            !inMeld.has(cardOrder(card)) &&
            ends.some((e) => adjacent(e, cardOrder(card)))
          ) {
            // Keep run cards ordered so the ends stay at the boundaries.
            if (adjacent(orders[orders.length - 1]!, cardOrder(card))) {
              meld.cards.push(card);
            } else {
              meld.cards.unshift(card);
            }
            layoffs.push(card);
            remaining.splice(i, 1);
            changed = true;
            break;
          }
        }
      }
    }
  }

  return layoffs;
}
