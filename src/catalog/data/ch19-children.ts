import type { CatalogEntry } from "../types";

/**
 * Chapter 19 — Children and Family Card Games.
 * All rules text is original prose describing these traditional games;
 * bookPage cites where Scarne covers each one.
 */
export const CH19_CHILDREN: CatalogEntry[] = [
  {
    slug: "war",
    name: "War",
    chapter: 19,
    family: "children",
    players: "2",
    deck: "standard 52",
    complexity: 1,
    bookPage: 362,
    playableId: "war",
    rulesHtml: `
      <p><strong>Goal:</strong> Capture every card in the deck.</p>
      <p><strong>Deal:</strong> Split the deck evenly, face-down. Nobody looks at their cards.</p>
      <p><strong>Play:</strong> Both players flip their top card at once. The higher rank captures both cards (aces high); captured cards go under the winner's pile.</p>
      <p><strong>War:</strong> On a tie, each player buries one card face-down and flips a new card. The higher flip takes the whole spread. Ties repeat the process.</p>
      <p><strong>Win:</strong> Take all 52 cards — or hold the most when you call time.</p>
    `,
  },
  {
    slug: "i-doubt-it",
    name: "I Doubt It",
    aka: ["Cheat", "Bluff"],
    chapter: 19,
    family: "children",
    players: "3–8",
    deck: "standard 52",
    complexity: 1,
    bookPage: 361,
    rulesHtml: `
      <p><strong>Goal:</strong> Be the first to play away every card in your hand.</p>
      <p><strong>Deal:</strong> The whole deck, as evenly as possible.</p>
      <p><strong>Play:</strong> In turn, each player discards one to four cards <em>face-down</em>, announcing them as the next rank in sequence ("two Aces", "three Twos", ...). Lying is allowed — and often necessary.</p>
      <p><strong>Challenge:</strong> Any player may call "I doubt it!" before the next turn. The discard is flipped: if the claim was false, the liar takes the whole pile; if it was true, the doubter takes it.</p>
      <p><strong>Variant — Three-Card I Doubt It:</strong> every play must be exactly three cards, making bigger lies unavoidable.</p>
    `,
  },
  {
    slug: "go-fish",
    name: "Go Fish",
    aka: ["Fish"],
    chapter: 19,
    family: "children",
    players: "2–5",
    deck: "standard 52",
    complexity: 1,
    bookPage: 364,
    playableId: "go-fish",
    rulesHtml: `
      <p><strong>Goal:</strong> Collect the most <strong>books</strong> (all four cards of a rank).</p>
      <p><strong>Deal:</strong> 7 cards each with two players, 5 each with more. The rest becomes the fishing pond.</p>
      <p><strong>Play:</strong> On your turn, ask a chosen opponent for a rank you already hold. If they have any, they hand them all over and you ask again. If not — "Go fish": draw from the pond and play passes on (unless you draw the rank you asked for, which earns another turn).</p>
      <p><strong>Books:</strong> Completed sets of four go face-up in front of you.</p>
      <p><strong>Win:</strong> When all books are made, the player with the most wins.</p>
    `,
  },
  {
    slug: "authors",
    name: "Authors",
    chapter: 19,
    family: "children",
    players: "3–6",
    deck: "standard 52",
    complexity: 1,
    bookPage: 363,
    rulesHtml: `
      <p><strong>Goal:</strong> Collect the most books of four-of-a-rank.</p>
      <p><strong>Deal:</strong> The whole deck, one card at a time.</p>
      <p><strong>Play:</strong> Like Go Fish, but sharper: ask a specific opponent for one <em>exact card</em> (rank and suit) — you must already hold at least one card of that rank. A hit lets you keep asking anyone; a miss passes the turn to the player you asked.</p>
      <p>With no draw pile, every question leaks information — remember what each player asks for.</p>
      <p><strong>Win:</strong> Most completed books when hands run out.</p>
    `,
  },
  {
    slug: "old-maid",
    name: "Old Maid",
    chapter: 19,
    family: "children",
    players: "2–8",
    deck: "51 cards (one Queen removed)",
    complexity: 1,
    bookPage: 363,
    playableId: "old-maid",
    rulesHtml: `
      <p><strong>Goal:</strong> Don't be the one holding the odd Queen at the end.</p>
      <p><strong>Setup:</strong> Remove one Queen from the deck, then deal everything out.</p>
      <p><strong>Play:</strong> Everyone discards the pairs from their hand. Then, in turn, each player offers their hand face-down to the neighbor on the left, who draws one card and discards any new pair it makes.</p>
      <p><strong>End:</strong> Pairing continues until every card is matched — except one unmatchable Queen. Its holder is the Old Maid and loses.</p>
    `,
  },
  {
    slug: "persian-pasha",
    name: "Persian Pasha",
    aka: ["Pasha"],
    chapter: 19,
    family: "children",
    players: "2",
    deck: "standard 52",
    complexity: 1,
    bookPage: 363,
    rulesHtml: `
      <p><strong>Goal:</strong> Capture your opponent's cards.</p>
      <p><strong>Deal:</strong> Split the deck evenly, face-down.</p>
      <p><strong>Play:</strong> Both players turn cards up in unison onto their own pile. When the two face-up cards happen to share a suit, the higher rank captures the other player's entire face-up pile.</p>
      <p><strong>Win:</strong> Take all the cards, or hold the most when the deal runs out.</p>
    `,
  },
  {
    slug: "donkey",
    name: "Donkey",
    chapter: 19,
    family: "children",
    players: "3–13",
    deck: "one 4-card set per player",
    complexity: 1,
    bookPage: 364,
    rulesHtml: `
      <p><strong>Goal:</strong> Collect four of a kind — or at least notice when someone else does.</p>
      <p><strong>Setup:</strong> Use one four-of-a-kind set per player (three players: e.g. Aces, Kings, Queens). Deal four cards each.</p>
      <p><strong>Play:</strong> Everyone simultaneously passes one unwanted card to the left, over and over, no turns.</p>
      <p><strong>The grab:</strong> The first player to assemble four of a kind quietly stops passing (traditionally, touches the table). Everyone else must react and do the same — the last to notice takes a letter of D-O-N-K-E-Y.</p>
      <p><strong>Lose:</strong> Spell the whole word and you're the donkey.</p>
    `,
  },
  {
    slug: "pig",
    name: "Pig",
    chapter: 19,
    family: "children",
    players: "3–13",
    deck: "one 4-card set per player",
    complexity: 1,
    bookPage: 365,
    rulesHtml: `
      <p><strong>Goal:</strong> Same racing four-of-a-kind as Donkey, with a sillier tell.</p>
      <p><strong>Play:</strong> Cards pass simultaneously to the left. When someone completes four of a kind, they stop passing and touch their nose. Anyone who spots a nose-toucher touches their own.</p>
      <p><strong>Lose:</strong> The last player still passing cards is the Pig.</p>
    `,
  },
  {
    slug: "my-ship-sails",
    name: "My Ship Sails",
    chapter: 19,
    family: "children",
    players: "4–7",
    deck: "standard 52",
    complexity: 1,
    bookPage: 365,
    rulesHtml: `
      <p><strong>Goal:</strong> Be the first to hold seven cards of a single suit.</p>
      <p><strong>Deal:</strong> Seven cards each.</p>
      <p><strong>Play:</strong> Everyone simultaneously passes one card face-down to the left, continuously.</p>
      <p><strong>Win:</strong> The moment your hand is all one suit, call "My ship sails!" First caller wins.</p>
    `,
  },
  {
    slug: "slap-jack",
    name: "Slap Jack",
    chapter: 19,
    family: "children",
    players: "2–8",
    deck: "standard 52",
    complexity: 1,
    bookPage: 365,
    playableId: undefined,
    rulesHtml: `
      <p><strong>Goal:</strong> Win every card by being quickest to the Jacks.</p>
      <p><strong>Deal:</strong> The whole deck, face-down, as evenly as possible.</p>
      <p><strong>Play:</strong> In turn, players flip their top card onto a central pile. When a <strong>Jack</strong> appears, everyone slaps — the first hand on it takes the whole pile.</p>
      <p><strong>Penalty:</strong> Slap anything that isn't a Jack and you pay a card to the player who flipped it.</p>
      <p><strong>Win:</strong> Players with no cards get one last chance to slap back in; the player who ends up with everything wins.</p>
    `,
  },
  {
    slug: "snap",
    name: "Snap",
    chapter: 19,
    family: "children",
    players: "2–6",
    deck: "standard 52",
    complexity: 1,
    bookPage: 365,
    rulesHtml: `
      <p><strong>Goal:</strong> Win all the cards.</p>
      <p><strong>Deal:</strong> The whole deck, face-down piles, as evenly as possible.</p>
      <p><strong>Play:</strong> In turn, each player flips their top card onto their own face-up pile. When any two face-up piles show the <strong>same rank</strong>, the first player to shout "Snap!" takes both piles.</p>
      <p><strong>Penalty:</strong> A false snap costs a card to each opponent.</p>
      <p><strong>Win:</strong> Collect the whole deck.</p>
    `,
  },
  {
    slug: "animals",
    name: "Animals",
    aka: ["Menagerie"],
    chapter: 19,
    family: "children",
    players: "3–8",
    deck: "standard 52",
    complexity: 1,
    bookPage: 366,
    rulesHtml: `
      <p><strong>Goal:</strong> Win all the cards — if you can say "rhinoceros" three times fast.</p>
      <p><strong>Setup:</strong> Each player adopts an animal name; the longer and harder to pronounce, the better. Everyone memorizes everyone's animal. Deal out the deck face-down.</p>
      <p><strong>Play:</strong> In turn, players flip cards onto personal face-up piles. When two piles match in rank, the two owners race: each must call out the <em>other player's</em> animal name three times. The faster caller takes the loser's face-up pile.</p>
      <p><strong>Win:</strong> Capture everything.</p>
    `,
  },
  {
    slug: "concentration",
    name: "Concentration",
    aka: ["Memory", "Pelmanism"],
    chapter: 19,
    family: "children",
    players: "2–6",
    deck: "standard 52",
    complexity: 1,
    bookPage: 366,
    rulesHtml: `
      <p><strong>Goal:</strong> Collect the most pairs from a face-down spread.</p>
      <p><strong>Setup:</strong> Spread the whole deck face-down — neat grid or scattered, as agreed.</p>
      <p><strong>Play:</strong> On your turn, flip any two cards for all to see. A matching rank pair is yours — keep it and go again. Otherwise flip them back exactly where they were and pass the turn.</p>
      <p><strong>Win:</strong> Most pairs when the layout is exhausted. Pure memory — no luck after the shuffle.</p>
    `,
  },
  {
    slug: "cuckoo",
    name: "Cuckoo",
    aka: ["Ranter-Go-Round", "Chase the Ace"],
    chapter: 19,
    family: "children",
    players: "3–13",
    deck: "standard 52",
    complexity: 1,
    bookPage: 366,
    rulesHtml: `
      <p><strong>Goal:</strong> Don't hold the lowest card at the table.</p>
      <p><strong>Deal:</strong> One card each. Everyone starts with three lives (chips).</p>
      <p><strong>Play:</strong> Starting left of the dealer, each player may keep their card or force a swap with the left-hand neighbor. A neighbor holding a <strong>King</strong> shows it and blocks the swap ("Cuckoo!"). The dealer, last to act, may instead cut a new card from the deck.</p>
      <p><strong>Showdown:</strong> All cards flip; the lowest rank (aces low) loses a life. Out of lives, out of the game.</p>
      <p><strong>Win:</strong> Be the last player alive.</p>
    `,
  },
  {
    slug: "stealing-bundles",
    name: "Stealing the Old Man's Bundle",
    aka: ["Stealing Bundles", "Old Man's Bundle"],
    chapter: 19,
    family: "children",
    players: "2–4",
    deck: "standard 52",
    complexity: 1,
    bookPage: 367,
    rulesHtml: `
      <p><strong>Goal:</strong> End with the most captured cards.</p>
      <p><strong>Deal:</strong> Four cards each and four face-up on the table; re-deal hands as they empty until the deck is gone.</p>
      <p><strong>Play:</strong> In turn, either capture a table card that matches one in your hand by rank, or trail a card to the table. Captured cards stack <em>face-up</em> as your bundle.</p>
      <p><strong>The steal:</strong> Match the top card of an opponent's bundle and the whole bundle is yours.</p>
      <p><strong>Win:</strong> Most cards captured when the deck runs out.</p>
    `,
  },
  {
    slug: "frogs-in-the-pond",
    name: "Frogs in the Pond",
    chapter: 19,
    family: "children",
    players: "2–4",
    deck: "standard 52",
    complexity: 2,
    bookPage: 367,
    rulesHtml: `
      <p><strong>Goal:</strong> Score the most points from captured cards.</p>
      <p><strong>Deal:</strong> Each player gets a hand plus a personal row of face-down "frog" cards on the table.</p>
      <p><strong>Play:</strong> Tricks are led and won by high card. The twist: a trick's winner must also take a blind frog from their pond into their capture pile — treasure or trash, sight unseen.</p>
      <p><strong>Scoring:</strong> Count captured point cards (aces and face cards score; exact schedule agreed before play).</p>
      <p><strong>Win:</strong> Highest total after the ponds are empty.</p>
    `,
  },
  {
    slug: "twenty-nine",
    name: "Twenty-Nine",
    chapter: 19,
    family: "children",
    players: "3–4",
    deck: "standard 52",
    complexity: 2,
    bookPage: 368,
    rulesHtml: `
      <p><strong>Goal:</strong> Capture piles by landing the count exactly on <strong>29</strong>.</p>
      <p><strong>Deal:</strong> The whole deck, evenly (with three players, set the last card aside).</p>
      <p><strong>Play:</strong> Players add cards to a central pile in turn, announcing the running total. Face cards count 1, aces 1, others face value. The total may never pass 29.</p>
      <p><strong>Capture:</strong> The player who makes the count exactly 29 takes the pile and a fresh count starts.</p>
      <p><strong>Win:</strong> Most cards captured when hands are empty. Simple — but counting to 29 in your head is the whole game for young players.</p>
    `,
  },
];
