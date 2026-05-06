import type { PlayingCard } from "typedeck";
import { cardOrder, cardKey } from "../../shared/deck";
import { pipValue, type Meld } from "./types";

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

export function findAllRuns(hand: PlayingCard[]): Meld[] {
  const bySuit = new Map<number, PlayingCard[]>();
  for (const c of hand) {
    if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
    bySuit.get(c.suit)!.push(c);
  }

  const melds: Meld[] = [];
  for (const suitCards of bySuit.values()) {
    suitCards.sort((a, b) => cardOrder(a) - cardOrder(b));
    const unique: PlayingCard[] = [];
    for (const c of suitCards) {
      if (
        unique.length === 0 ||
        cardOrder(c) !== cardOrder(unique[unique.length - 1]!)
      ) {
        unique.push(c);
      }
    }

    let start = 0;
    while (start < unique.length) {
      let end = start;
      while (
        end + 1 < unique.length &&
        cardOrder(unique[end + 1]!) === cardOrder(unique[end]!) + 1
      ) {
        end++;
      }
      const seqLen = end - start + 1;
      if (seqLen >= 3) {
        for (let len = 3; len <= seqLen; len++) {
          for (let i = start; i + len - 1 <= end; i++) {
            melds.push({
              type: "run",
              cards: unique.slice(i, i + len),
            });
          }
        }
      }
      start = end + 1;
    }
  }
  return melds;
}

export function findBestMelds(hand: PlayingCard[]): {
  melds: Meld[];
  deadwood: PlayingCard[];
} {
  const allMelds = [...findAllSets(hand), ...findAllRuns(hand)];

  let bestDeadwoodValue = Infinity;
  let bestMelds: Meld[] = [];

  function backtrack(idx: number, used: Set<string>, chosen: Meld[]) {
    const usedCards = new Set(used);
    const dw = hand.filter((c) => !usedCards.has(cardKey(c)));
    const dwVal = dw.reduce((sum, c) => sum + pipValue(c), 0);

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

export function deadwoodValue(cards: PlayingCard[]): number {
  return cards.reduce((sum, c) => sum + pipValue(c), 0);
}

export function calculateDeadwood(hand: PlayingCard[]): number {
  return deadwoodValue(findBestMelds(hand).deadwood);
}

export function canKnock(hand: PlayingCard[]): boolean {
  return calculateDeadwood(hand) <= 10;
}

export function isGin(hand: PlayingCard[]): boolean {
  return calculateDeadwood(hand) === 0;
}

export function findLayoffs(
  defenderDeadwood: PlayingCard[],
  knockerMelds: Meld[],
): PlayingCard[] {
  const layoffs: PlayingCard[] = [];
  const remaining = [...defenderDeadwood];
  const melds = knockerMelds.map((m) => ({ ...m, cards: [...m.cards] }));

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
          const sorted = [...meld.cards].sort(
            (a, b) => cardOrder(a) - cardOrder(b),
          );
          const low = cardOrder(sorted[0]!);
          const high = cardOrder(sorted[sorted.length - 1]!);
          if (
            card.suit === sorted[0]!.suit &&
            (cardOrder(card) === low - 1 || cardOrder(card) === high + 1)
          ) {
            meld.cards.push(card);
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
