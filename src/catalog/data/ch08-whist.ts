import type { CatalogEntry } from "../types";

/**
 * Chapter 8 — Other Games in the Whist Family (plus Spades, which postdates
 * the book but belongs to this family).
 * Original prose; bookPage cites where Scarne covers each game.
 */
export const CH08_WHIST: CatalogEntry[] = [
  {
    slug: "whist",
    name: "Whist",
    chapter: 8,
    family: "whist",
    players: "4 (partners)",
    deck: "standard 52",
    complexity: 2,
    bookPage: 157,
    playableId: "whist",
    rulesHtml: `
      <p><strong>Goal:</strong> Win more tricks than the other partnership.</p>
      <p><strong>Deal:</strong> Thirteen cards each; the dealer's final card is turned face-up and fixes trump (the dealer keeps it).</p>
      <p><strong>Play:</strong> Eldest leads. Follow suit if able; trump beats the led suit; ace is high. The trick winner leads next.</p>
      <p><strong>Scoring:</strong> Each trick past six — the "odd tricks" — scores one point for the side that took it. First partnership to seven points wins.</p>
      <p>Two centuries of card theory started here — no bidding, no conventions, just pure play of the hand.</p>
    `,
  },
  {
    slug: "knockout-whist",
    name: "Knockout Whist",
    aka: ["Trumps"],
    chapter: 8,
    family: "whist",
    players: "2–7",
    deck: "standard 52",
    complexity: 1,
    playableId: "whist",
    presetId: "knockout",
    rulesHtml: `
      <p><strong>Goal:</strong> Survive. Take at least one trick every hand or you're out.</p>
      <p><strong>Deals shrink:</strong> seven cards each, then six, five … down to one. Trump is turned for the first hand; after that, whoever took the most tricks names trump for the next.</p>
      <p><strong>Knockout:</strong> Finish a hand with zero tricks and you're eliminated.</p>
      <p><strong>Win:</strong> Be the last player standing.</p>
    `,
  },
  {
    slug: "oh-hell",
    name: "Oh Hell",
    aka: ["Oh Pshaw", "Blackout", "Nomination Whist"],
    chapter: 8,
    family: "whist",
    players: "3–7",
    deck: "standard 52",
    complexity: 2,
    playableId: "whist",
    presetId: "oh-hell",
    rulesHtml: `
      <p><strong>Goal:</strong> Take <em>exactly</em> the number of tricks you bid — no more, no fewer.</p>
      <p><strong>Deals grow:</strong> one card each, then two, and so on. Trump is turned fresh each deal.</p>
      <p><strong>The hook:</strong> Players bid in rotation; the dealer may not bid a number that would make total bids equal the tricks available — someone must always be wrong.</p>
      <p><strong>Scoring:</strong> Hit your bid exactly for ten points plus the bid; miss by any margin and score nothing. Highest total after the last deal wins.</p>
    `,
  },
  {
    slug: "norwegian-whist",
    name: "Norwegian Whist",
    chapter: 8,
    family: "whist",
    players: "4 (partners)",
    deck: "standard 52",
    complexity: 3,
    playableId: "whist",
    presetId: "norwegian",
    rulesHtml: `
      <p><strong>Goal:</strong> There is never a trump — the fight is over which <em>direction</em> the hand plays.</p>
      <p><strong>Declaring:</strong> In rotation, each player may declare <strong>grand</strong> (their side tries to win tricks) or <strong>nullo</strong> (tries to lose them). The first declaration stands; if all four pass, the hand is nullo.</p>
      <p><strong>Scoring:</strong> Odd tricks score for the appropriate side — defenders earn more for beating a grand than declarers do for making one. Game to fifty.</p>
    `,
  },
  {
    slug: "chinese-whist",
    name: "Chinese Whist",
    chapter: 8,
    family: "whist",
    players: "2–4",
    deck: "standard 52",
    complexity: 3,
    bookPage: 161,
    rulesHtml: `
      <p><strong>Goal:</strong> Ordinary whist tricks — with half your hand nailed to the table.</p>
      <p>Each player's cards are dealt half face-down in a row, half face-up on top of them. You may play from your visible cards (or hand, in the two-hand game); winning a covered card's cover exposes it for later use.</p>
      <p>Every capture changes what everyone can see — the game is as much memory and disclosure as card power.</p>
    `,
  },
  {
    slug: "spades",
    name: "Spades",
    family: "whist",
    players: "4 (partners)",
    deck: "standard 52",
    complexity: 3,
    playableId: "spades",
    rulesHtml: `
      <p><strong>Goal:</strong> Make your partnership's combined bid. Spades are always trump.</p>
      <p><strong>Bidding:</strong> Each player bids the tricks they expect to take (team contract = both bids); bid <strong>nil</strong> to promise zero tricks for a 100-point bonus — or penalty.</p>
      <p><strong>Play:</strong> Follow suit if able. Spades can't be led until one has been discarded on another suit.</p>
      <p><strong>Scoring:</strong> Make the contract for ten points per trick bid; overtricks ("bags") score one each but every tenth bag costs 100. Set contracts lose ten per trick bid. Game to 500.</p>
    `,
  },
];
