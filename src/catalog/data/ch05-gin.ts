import type { CatalogEntry } from "../types";

/**
 * Chapter 5 — Gin Rummy variants. (Gin itself lives in existing-games.ts.)
 * Original prose; bookPage cites where Scarne covers each variant.
 */
export const CH05_GIN: CatalogEntry[] = [
  {
    slug: "oklahoma-gin",
    name: "Oklahoma Gin",
    chapter: 5,
    family: "rummy",
    players: "2",
    deck: "standard 52",
    complexity: 3,
    playableId: "gin",
    presetId: "oklahoma",
    rulesHtml: `
      <p><strong>Goal:</strong> Gin Rummy where the deal itself sets the difficulty.</p>
      <p>The value of the first upcard caps the knock for the whole hand — a 7 means knock at 7 or less; an <strong>ace means gin only</strong>.</p>
      <p>When that first upcard is a <strong>spade</strong>, the hand's score doubles. Fortunes swing harder, and a spade-ace deal is the tensest hand in gin.</p>
    `,
  },
  {
    slug: "hollywood-gin",
    name: "Hollywood Gin",
    aka: ["Hollywood Scoring"],
    chapter: 5,
    family: "rummy",
    players: "2",
    deck: "standard 52",
    complexity: 3,
    playableId: "gin",
    presetId: "hollywood",
    rulesHtml: `
      <p><strong>Goal:</strong> Standard gin play, scored as <strong>three games at once</strong>.</p>
      <p>Your first win enters game one; your second enters games one and two; from your third on, every win scores in all three columns. Each column closes at the target score.</p>
      <p>One bad start can lose you three games at a stroke — which is exactly the point.</p>
    `,
  },
  {
    slug: "round-the-corner-gin",
    name: "Round-the-Corner Gin",
    chapter: 5,
    family: "rummy",
    players: "2",
    deck: "standard 52",
    complexity: 3,
    playableId: "gin",
    presetId: "round-the-corner",
    rulesHtml: `
      <p><strong>Goal:</strong> Gin with wrap-around runs — King-Ace-Two is a legal meld, and the ace joins either end of a sequence.</p>
      <p>Aces still count just 1 against you as deadwood, which makes them pure upside: cheap to hold, and they connect twice as many runs.</p>
    `,
  },
  {
    slug: "partnership-gin",
    name: "Partnership Gin",
    chapter: 5,
    family: "rummy",
    players: "4 (two teams)",
    deck: "two standard 52s",
    complexity: 3,
    bookPage: 92,
    rulesHtml: `
      <p><strong>Goal:</strong> Team gin — each player faces one opponent at their own deck, and the two table results net into a single team score each round.</p>
      <p>A win at your table can be wiped out by your partner's loss; only the combined margin lands on the sheet. First team to the target wins.</p>
    `,
  },
];
