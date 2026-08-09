import type { CatalogEntry } from "../types";

/**
 * Chapter 14 — The Heart Group. (Hearts itself lives in existing-games.ts.)
 * Original prose; bookPage cites Scarne's coverage.
 */
export const CH14_HEARTS: CatalogEntry[] = [
  {
    slug: "spot-hearts",
    name: "Spot Hearts",
    chapter: 14,
    family: "hearts",
    players: "3–7",
    deck: "standard 52",
    complexity: 2,
    playableId: "hearts",
    presetId: "spot",
    rulesHtml: `
      <p><strong>Goal:</strong> Hearts where every heart hurts by its size.</p>
      <p>Each captured heart counts its pip value against you — spot cards at face value, Jack 11, Queen 12, King 13, Ace 14. That's 104 points of pain per deal, and no Queen of Spades to worry about.</p>
      <p>Shooting the moon means sweeping <em>all</em> the hearts. Lose at 500.</p>
    `,
  },
  {
    slug: "black-maria",
    name: "Black Maria",
    aka: ["Slippery Anne"],
    chapter: 14,
    family: "hearts",
    players: "3–7",
    deck: "standard 52",
    complexity: 3,
    bookPage: 267,
    playableId: "hearts",
    presetId: "black-maria",
    rulesHtml: `
      <p><strong>Goal:</strong> Hearts with three spade landmines instead of one.</p>
      <p>The Queen of Spades still costs 13 — and now the King costs 10 and the Ace 7. Three cards pass to the <strong>right</strong> before every hand, no rotation.</p>
      <p>Holding high spades is a slow-motion catastrophe; unloading them at the right moment is the whole art.</p>
    `,
  },
  {
    slug: "omnibus-hearts",
    name: "Omnibus Hearts",
    chapter: 14,
    family: "hearts",
    players: "3–7",
    deck: "standard 52",
    complexity: 3,
    bookPage: 268,
    playableId: "hearts",
    presetId: "omnibus",
    rulesHtml: `
      <p><strong>Goal:</strong> Standard hearts plus one card worth <em>winning</em>: capture the <strong>Jack of Diamonds</strong> for minus ten.</p>
      <p>Every trick now has two currents — dodging the penalties while angling for the Jack. Scarne considered this the best version of the game, and most serious hearts circles agree.</p>
    `,
  },
  {
    slug: "domino-hearts",
    name: "Domino Hearts",
    chapter: 14,
    family: "hearts",
    players: "3–7",
    deck: "standard 52",
    complexity: 2,
    bookPage: 265,
    rulesHtml: `
      <p><strong>Goal:</strong> Hearts with a draw pile — six cards each, and when you can't follow suit you draw from the stock until you can.</p>
      <p>Hands swell before they shrink; a player who empties their hand drops out, and the last player holding cards eats whatever hearts remain.</p>
    `,
  },
  {
    slug: "draw-hearts",
    name: "Draw Hearts",
    chapter: 14,
    family: "hearts",
    players: "2",
    deck: "standard 52",
    complexity: 2,
    bookPage: 266,
    rulesHtml: `
      <p><strong>Goal:</strong> Two-hand hearts. Thirteen cards each; after every trick both players draw from the stock, so the whole deck flows through the hands.</p>
      <p>Card counting matters double when every heart is destined for one of only two piles.</p>
    `,
  },
];
