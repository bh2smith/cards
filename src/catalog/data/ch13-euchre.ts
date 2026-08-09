import type { CatalogEntry } from "../types";

/**
 * Chapter 13 — The Big Euchre Family. (Partnership Euchre itself lives in
 * existing-games.ts.) Original prose; bookPage cites Scarne's coverage.
 */
export const CH13_EUCHRE: CatalogEntry[] = [
  {
    slug: "cutthroat-euchre",
    name: "Cutthroat Euchre",
    aka: ["Three-Handed Euchre"],
    chapter: 13,
    family: "euchre",
    players: "3",
    deck: "24 cards (9–A)",
    complexity: 3,
    bookPage: 239,
    playableId: "euchre",
    presetId: "cutthroat",
    rulesHtml: `
      <p><strong>Goal:</strong> Euchre for three — the trump maker stands alone against a temporary alliance of the other two.</p>
      <p>Bidding works as in partnership euchre (order up the turned card, or name a suit on the second round). The maker needs three of the five tricks.</p>
      <p><strong>Scoring:</strong> Maker takes three or four tricks for one point, all five for three. If the maker is euchred, <em>each</em> defender scores two — betrayal pays double.</p>
    `,
  },
  {
    slug: "railroad-euchre",
    name: "Railroad Euchre",
    chapter: 13,
    family: "euchre",
    players: "4 (partners)",
    deck: "25 cards (9–A + joker)",
    complexity: 3,
    bookPage: 239,
    playableId: "euchre",
    presetId: "railroad",
    rulesHtml: `
      <p><strong>Goal:</strong> Fast, loose euchre with a <strong>joker</strong> as the best bower — the highest trump, above the right bower.</p>
      <p>Going alone gets stronger: the loner discards a card and takes their partner's best in exchange before play.</p>
      <p>Everything else follows partnership euchre; the joker just makes every "alone" call a little more reckless.</p>
    `,
  },
  {
    slug: "buck-euchre",
    name: "Buck Euchre",
    chapter: 13,
    family: "euchre",
    players: "3–5",
    deck: "24–32 cards",
    complexity: 3,
    bookPage: 240,
    rulesHtml: `
      <p><strong>Goal:</strong> Every player for themselves, and everyone plays — no passing out of a hand.</p>
      <p>Players start with 25 points and count <em>down</em> by tricks taken; take no trick and your score climbs instead. First to zero wins.</p>
      <p>A chip-game cousin of cutthroat euchre, popular wherever euchre players want blood.</p>
    `,
  },
  {
    slug: "double-hasenpfeffer",
    name: "Double Hasenpfeffer",
    chapter: 13,
    family: "euchre",
    players: "4 or 6 (teams)",
    deck: "48 cards (double 24)",
    complexity: 4,
    bookPage: 249,
    rulesHtml: `
      <p><strong>Goal:</strong> Big-deck euchre with real bidding — partnerships bid the number of tricks (out of twelve) they'll take, and the high bid names trump.</p>
      <p>Two 24-card euchre decks shuffled together; duplicate cards make the second-played duplicate lose. Bidders who fail are set back the full bid.</p>
      <p>The bridge between euchre and the bidding games it fathered.</p>
    `,
  },
  {
    slug: "five-hundred",
    name: "Five Hundred",
    chapter: 13,
    family: "euchre",
    players: "2–6 (best at 4)",
    deck: "43–46 cards + joker",
    complexity: 4,
    bookPage: 245,
    rulesHtml: `
      <p><strong>Goal:</strong> First side to 500 points, won through a bidding ladder of suit-and-number contracts.</p>
      <p>Euchre's bowers survive, topped by the joker. The high bidder takes the three-card widow into hand and discards three before play.</p>
      <p>Contracts score by a fixed schedule that rises with suit rank and trick count; failed contracts set the bidders back the full value. The great Australian card game, and euchre's most ambitious child.</p>
    `,
  },
  {
    slug: "skat",
    name: "Skat",
    chapter: 13,
    family: "euchre",
    players: "3",
    deck: "32 cards (7–A)",
    complexity: 5,
    bookPage: 254,
    rulesHtml: `
      <p><strong>Goal:</strong> The lone declarer, established by a numerical auction, tries to take 61 of the 120 card points against the two defenders.</p>
      <p>The four jacks are permanent top trumps in a fixed order; game values multiply out of the contract type, the trump suit, and the matadors held. The two-card <em>skat</em> buried on the table gives the game its name.</p>
      <p>Germany's national card game — the deepest three-hand game ever devised, and a long-term goal for this project rather than a quick preset.</p>
    `,
  },
];
