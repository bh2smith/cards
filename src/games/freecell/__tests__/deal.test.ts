import { test, expect, describe } from "bun:test";
import { RANK_DISPLAY, SUIT_SYMBOL, cardKey } from "../../../shared/deck";
import { dealColumns } from "../deal";
import type { PlayingCard } from "typedeck";

const SUIT_LETTER: Record<string, string> = {
  "♣": "C",
  "♦": "D",
  "♥": "H",
  "♠": "S",
};

function short(card: PlayingCard): string {
  const rank =
    RANK_DISPLAY[card.cardName] === "10" ? "T" : RANK_DISPLAY[card.cardName];
  return `${rank}${SUIT_LETTER[SUIT_SYMBOL[card.suit]!]}`;
}

describe("dealColumns", () => {
  test("reproduces Microsoft FreeCell deal #1", () => {
    const cols = dealColumns(1).map((c) => c.map(short).join(" "));
    expect(cols).toEqual([
      "JD KD 2S 4C 3S 6D 6S",
      "2D KC KS 5C TD 8S 9C",
      "9H 9S 9D TS 4S 8D 2H",
      "JC 5S QD QH TH QS 6H",
      "5D AD JS 4H 8H 6C",
      "7H QC AS AC 2C 3D",
      "7C KH AH 4D JH 8C",
      "5H 3H 3C 7S 7D TC",
    ]);
  });

  test("deals 52 unique cards across 8 columns (7,7,7,7,6,6,6,6)", () => {
    const cols = dealColumns(617);
    expect(cols.length).toBe(8);
    expect(cols.map((c) => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    const all = cols.flat();
    expect(all.length).toBe(52);
    expect(new Set(all.map(cardKey)).size).toBe(52);
  });

  test("is deterministic — same number yields the same deal", () => {
    const a = dealColumns(12345).flat().map(short).join(",");
    const b = dealColumns(12345).flat().map(short).join(",");
    expect(a).toBe(b);
  });

  test("different numbers yield different deals", () => {
    const a = dealColumns(1).flat().map(short).join(",");
    const b = dealColumns(2).flat().map(short).join(",");
    expect(a).not.toBe(b);
  });
});
