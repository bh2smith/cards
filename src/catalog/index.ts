import type { CatalogEntry } from "./types";
import { EXISTING_GAMES } from "./data/existing-games";
import { CH17_STOPS } from "./data/ch17-stops";
import { CH19_CHILDREN } from "./data/ch19-children";

export const CHAPTER_NAMES: Record<number, string> = {
  1: "General Rules",
  2: "Draw Poker",
  3: "Stud Poker",
  4: "Rummy Games",
  5: "Gin Rummy",
  6: "Canasta",
  7: "Bridge",
  8: "The Whist Family",
  9: "Pinochle",
  10: "The Bezique Family",
  11: "Cribbage",
  12: "Casino",
  13: "The Euchre Family",
  14: "The Hearts Group",
  15: "The All-Fours Group",
  16: "Banking Games",
  17: "Stops Games",
  18: "Skarney",
  19: "Children & Family Games",
  20: "Miscellaneous Games",
  21: "Solitaire & Patience",
  22: "Cheating at Cards",
};

/** Group label for house games that aren't in the encyclopedia. */
export const BEYOND_THE_BOOK = "Beyond the Book";

export const ALL_ENTRIES: CatalogEntry[] = [
  ...EXISTING_GAMES,
  ...CH17_STOPS,
  ...CH19_CHILDREN,
];

const entriesBySlug = new Map(ALL_ENTRIES.map((e) => [e.slug, e]));

export function getEntry(slug: string): CatalogEntry | undefined {
  return entriesBySlug.get(slug);
}

export function searchEntries(query: string): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_ENTRIES;
  return ALL_ENTRIES.filter((e) =>
    [e.name, ...(e.aka ?? []), e.family].join(" ").toLowerCase().includes(q),
  );
}

export function groupLabel(entry: CatalogEntry): string {
  return entry.chapter !== undefined
    ? (CHAPTER_NAMES[entry.chapter] ?? `Chapter ${entry.chapter}`)
    : BEYOND_THE_BOOK;
}

/** Entries grouped for the browse view, in chapter order, house games last. */
export function groupedEntries(
  entries: CatalogEntry[],
): Array<{ label: string; entries: CatalogEntry[] }> {
  const groups = new Map<string, CatalogEntry[]>();
  const sorted = [...entries].sort(
    (a, b) => (a.chapter ?? 99) - (b.chapter ?? 99),
  );
  for (const e of sorted) {
    const label = groupLabel(e);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(e);
  }
  return [...groups.entries()].map(([label, list]) => ({
    label,
    entries: list,
  }));
}
