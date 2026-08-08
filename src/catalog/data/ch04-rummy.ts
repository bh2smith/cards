import type { CatalogEntry } from "../types";

/**
 * Chapter 4 — The Rummy Games.
 * Original prose; bookPage cites where Scarne covers each game.
 */
export const CH04_RUMMY: CatalogEntry[] = [
  {
    slug: "straight-rummy",
    name: "Straight Rummy",
    aka: ["Rummy", "Rum"],
    chapter: 4,
    family: "rummy",
    players: "2–6",
    deck: "standard 52",
    complexity: 2,
    bookPage: 56,
    playableId: "rummy",
    rulesHtml: `
      <p><strong>Goal:</strong> Be first to shed your whole hand into melds.</p>
      <p><strong>Deal:</strong> Ten cards each (two players); the rest is the stock with one card turned to start the discard pile.</p>
      <p><strong>Play:</strong> Draw from the stock or take the top discard, optionally lay down <strong>sets</strong> (three or four of a rank) or <strong>runs</strong> (three-plus in suit sequence), lay off cards on any melds already on the table, then discard.</p>
      <p><strong>Scoring:</strong> Going out scores the pip total of the loser's remaining cards — face cards 10, aces 1. First to the target score wins the match.</p>
    `,
  },
  {
    slug: "knock-rummy",
    name: "Knock Rummy",
    aka: ["Poker Rum"],
    chapter: 4,
    family: "rummy",
    players: "2–5",
    deck: "standard 52",
    complexity: 2,
    playableId: "rummy",
    presetId: "knock-rummy",
    rulesHtml: `
      <p><strong>Goal:</strong> Knock with the lowest unmatched count — melds stay hidden until the showdown.</p>
      <p><strong>Play:</strong> Draw and discard as in rummy, but nothing is laid on the table. Any time after drawing you may <strong>knock</strong>, ending the hand at once — no minimum required.</p>
      <p><strong>Showdown:</strong> Both hands spread their best melds; the lower deadwood count wins the difference. An opponent who matches or beats the knocker's count <strong>undercuts</strong> for a bonus.</p>
      <p>The gamble is the whole game: knock early on a mediocre count, or hold out and risk being undercut.</p>
    `,
  },
  {
    slug: "500-rum",
    name: "Five Hundred Rum",
    aka: ["500 Rum", "Pinochle Rummy"],
    chapter: 4,
    family: "rummy",
    players: "2–4",
    deck: "standard 52",
    complexity: 3,
    playableId: "rummy",
    presetId: "500-rum",
    rulesHtml: `
      <p><strong>Goal:</strong> First to <strong>500 points</strong>, earned by melding — not just by going out.</p>
      <p><strong>The discard row:</strong> Discards spread in a visible row. You may take a card from <em>any depth</em> — but you take every card above it too, and the card you dug for must be melded immediately.</p>
      <p><strong>Scoring:</strong> Every card you meld scores its value for you as it lands (aces 15 in sets and high runs, 1 in A-2-3). When someone goes out, cards left in each hand count <em>against</em> their holder.</p>
      <p>Deep digs are the signature move: a rich haul of melds now, at the cost of a fat hand to shed later.</p>
    `,
  },
  {
    slug: "oklahoma-rum",
    name: "Oklahoma",
    chapter: 4,
    family: "rummy",
    players: "2–4",
    deck: "standard 52",
    complexity: 3,
    playableId: "rummy",
    presetId: "oklahoma-rum",
    rulesHtml: `
      <p><strong>Goal:</strong> Five Hundred Rum with two twists.</p>
      <p>A discard may be taken only if you can use it in a meld at once — no speculative digging.</p>
      <p>The <strong>Queen of Spades</strong> is the prize card: melding her scores a hefty bonus, and being caught with her in hand stings accordingly.</p>
    `,
  },
  {
    slug: "boathouse",
    name: "Boathouse Rum",
    chapter: 4,
    family: "rummy",
    players: "2–6",
    deck: "standard 52",
    complexity: 2,
    playableId: "rummy",
    presetId: "boathouse",
    rulesHtml: `
      <p><strong>Goal:</strong> Go <strong>rummy</strong> — your entire hand must meld at once; there is no laying down piecemeal.</p>
      <p><strong>The double draw:</strong> Take the top discard and you must also draw from the stock — two cards in, one card out, so hands swell.</p>
      <p><strong>Runs wrap:</strong> sequences go round the corner (King-Ace-Two is legal).</p>
      <p><strong>Scoring:</strong> The winner collects the pip value of each opponent's whole hand.</p>
    `,
  },
  {
    slug: "coon-can",
    name: "Coon Can",
    aka: ["Conquián"],
    chapter: 4,
    family: "rummy",
    players: "2",
    deck: "40 cards (no 8s, 9s, 10s)",
    complexity: 3,
    bookPage: 70,
    rulesHtml: `
      <p><strong>Goal:</strong> Meld <strong>eleven</strong> cards — one more than your hand holds, so the winning card always comes from the table.</p>
      <p>Played with the 40-card Spanish-style pack. Ten cards each; draw exposed cards in turn, meld sets and suit sequences, and lay off freely.</p>
      <p>The ancestor of the whole rummy family — tight, mathematical, and surprisingly modern for a game this old.</p>
    `,
  },
  {
    slug: "continental-rummy",
    name: "Continental Rummy",
    chapter: 4,
    family: "rummy",
    players: "2–12",
    deck: "2–3 decks + jokers",
    complexity: 3,
    bookPage: 74,
    rulesHtml: `
      <p><strong>Goal:</strong> Go out in a single stroke with a fifteen-card hand arranged entirely in <strong>runs</strong> — sets don't count.</p>
      <p>Multiple decks with jokers wild. Winning shapes are fixed (five three-card runs, or a 5-5-5, or 5-4-3-3...), and payouts scale with the shape and the wilds used.</p>
      <p>A big-table party rummy — the multi-deck wilds make every hand feel possible right up until someone else wins.</p>
    `,
  },
  {
    slug: "contract-rummy",
    name: "Contract Rummy",
    aka: ["Combination Rummy", "Liverpool Rummy"],
    chapter: 4,
    family: "rummy",
    players: "3–8",
    deck: "2–3 decks + jokers",
    complexity: 3,
    bookPage: 80,
    rulesHtml: `
      <p><strong>Goal:</strong> Complete a fixed <strong>contract</strong> each deal — two sets, then a set and a run, then two runs, and so on, each deal demanding more.</p>
      <p>You cannot meld anything until you can lay the whole contract at once. Later deals add cards to the hand and let players buy out-of-turn discards.</p>
      <p><strong>Win:</strong> Lowest accumulated penalty points after the final deal.</p>
    `,
  },
  {
    slug: "pan",
    name: "Panguingue",
    aka: ["Pan"],
    chapter: 4,
    family: "rummy",
    players: "2–15",
    deck: "8 stripped decks (320 cards)",
    complexity: 4,
    bookPage: 83,
    rulesHtml: `
      <p><strong>Goal:</strong> Meld eleven cards, gambling-house style.</p>
      <p>Eight 40-card decks shuffled together; players may drop out ("go on top") before play for a fixed forfeit. Melds ("spreads") follow special rules — certain ranks (3s, 5s, 7s) are <strong>valle</strong> cards that pay chips whenever spread.</p>
      <p>The classic card-room rummy of the American West; more a chip game than a hand game.</p>
    `,
  },
];
