import type { CatalogEntry } from "../types";

/** The games already playable in The Card Room. Slug = route id. */
export const EXISTING_GAMES: CatalogEntry[] = [
  {
    slug: "golf",
    name: "Golf Solitaire",
    chapter: 21,
    family: "solitaire",
    players: "1",
    deck: "standard 52",
    complexity: 1,
    playableId: "golf",
    rulesHtml: `
      <p><strong>Goal:</strong> Clear all cards from the tableau.</p>
      <p>Play cards from the bottom of each column onto the waste pile if they are <strong>one rank above or below</strong> the current waste card. Ranks wrap (King → Ace → Two).</p>
      <p>If no moves are available, draw from the stock. The game ends when the stock is empty and no more moves remain.</p>
      <p><strong>Win:</strong> Remove every card from the tableau.</p>
    `,
  },
  {
    slug: "pyramid",
    name: "Pyramid",
    chapter: 21,
    family: "solitaire",
    players: "1",
    deck: "standard 52",
    complexity: 1,
    playableId: "pyramid",
    rulesHtml: `
      <p><strong>Goal:</strong> Clear all cards from the pyramid.</p>
      <p>Remove pairs of <strong>exposed</strong> cards that add up to <strong>13</strong>. Kings (value 13) are removed alone.</p>
      <p>Card values: A=1, 2–10 face value, J=11, Q=12, K=13.</p>
      <p>A card is exposed when no cards overlap it from the row below. Draw from the stock when stuck.</p>
      <p><strong>Win:</strong> Remove every card from the pyramid.</p>
    `,
  },
  {
    slug: "klondike",
    name: "Klondike",
    aka: ["Canfield (misnomer)", "Patience"],
    chapter: 21,
    family: "solitaire",
    players: "1",
    deck: "standard 52",
    complexity: 2,
    playableId: "klondike",
    rulesHtml: `
      <p><strong>Goal:</strong> Move all 52 cards to the four foundation piles, building each suit up from Ace to King.</p>
      <p><strong>Tableau:</strong> Build down in <strong>alternating colors</strong> (red on black, black on red). Move single cards or sequences. Empty columns accept only Kings.</p>
      <p><strong>Stock:</strong> Draw cards to the waste pile. Play the top waste card to the tableau or foundations.</p>
      <p><strong>Flip:</strong> When a face-down card is uncovered, it automatically turns face-up.</p>
      <p><strong>Win:</strong> All four foundations built from Ace to King.</p>
    `,
  },
  {
    slug: "freecell",
    name: "Freecell",
    family: "solitaire",
    players: "1",
    deck: "standard 52",
    complexity: 3,
    playableId: "freecell",
    rulesHtml: `
      <p><strong>Goal:</strong> Move all 52 cards to the four foundation piles, building each suit up from Ace to King.</p>
      <p>All cards are dealt face-up into <strong>8 columns</strong> — every move is in plain sight.</p>
      <p><strong>Tableau:</strong> Build down in <strong>alternating colors</strong>. Move a single card, or a sequence if you have enough room.</p>
      <p><strong>Free cells:</strong> Four cells each hold one card as temporary storage. The number of free cells (and empty columns) limits how large a sequence you can move at once.</p>
      <p><strong>Deals are numbered</strong> — the same number always deals the same game, so you can replay or share a deal. Use Undo and Restart freely.</p>
    `,
  },
  {
    slug: "cribbage",
    name: "Cribbage",
    chapter: 11,
    family: "cribbage",
    players: "2",
    deck: "standard 52",
    complexity: 3,
    bookPage: 223,
    playableId: "cribbage",
    rulesHtml: `
      <p><strong>Goal:</strong> Be the first to reach <strong>121 points</strong>.</p>
      <p><strong>Deal:</strong> Each player gets 6 cards and discards 2 to the crib. The crib scores for the dealer.</p>
      <p><strong>Pegging:</strong> Alternate playing cards, counting toward 31. Score points for pairs, runs, and hitting 15 or 31.</p>
      <p><strong>Showing:</strong> After pegging, score your hand using the starter card — pairs, runs, fifteens, and flushes all count.</p>
      <p>The dealer alternates each round.</p>
    `,
  },
  {
    slug: "gin",
    name: "Gin Rummy",
    aka: ["Gin"],
    chapter: 5,
    family: "rummy",
    players: "2",
    deck: "standard 52",
    complexity: 3,
    bookPage: 86,
    playableId: "gin",
    rulesHtml: `
      <p><strong>Goal:</strong> Be the first to reach <strong>100 points</strong> across rounds.</p>
      <p>Each round, draw from the stock or discard pile, then discard one card. Arrange your hand into <strong>melds</strong>:</p>
      <ul>
        <li><strong>Sets</strong> — 3 or 4 cards of the same rank</li>
        <li><strong>Runs</strong> — 3+ consecutive cards of the same suit</li>
      </ul>
      <p><strong>Knock</strong> when your unmatched cards (deadwood) total 10 or less. <strong>Gin</strong> = zero deadwood for a bonus.</p>
      <p>The defender can lay off deadwood on the knocker's melds. Undercut the knocker for a bonus.</p>
    `,
  },
  {
    slug: "blackjack",
    name: "Blackjack",
    aka: ["Twenty-One", "B.J.", "Pontoon"],
    chapter: 16,
    family: "banking",
    players: "1 vs dealer",
    deck: "standard 52",
    complexity: 2,
    bookPage: 278,
    playableId: "blackjack",
    rulesHtml: `
      <p><strong>Goal:</strong> Beat the dealer by getting closer to <strong>21</strong> without going over.</p>
      <p><strong>Card values:</strong> Number cards = face value, Face cards = 10, Ace = 1 or 11.</p>
      <p><strong>Actions:</strong></p>
      <ul>
        <li><strong>Hit</strong> — draw another card</li>
        <li><strong>Stand</strong> — keep your hand</li>
        <li><strong>Double</strong> — double your bet, take exactly one more card</li>
        <li><strong>Split</strong> — split a pair into two hands (costs an extra bet)</li>
      </ul>
      <p>Dealer hits on soft 17. Blackjack (Ace + 10) pays 3:2. The gold-highlighted button shows basic strategy.</p>
    `,
  },
  {
    slug: "crazy-eights",
    name: "Crazy Eights",
    aka: ["Eights", "Swedish Rummy"],
    chapter: 17,
    family: "stops",
    players: "2–5",
    deck: "standard 52",
    complexity: 1,
    bookPage: 333,
    playableId: "crazy-eights",
    rulesHtml: `
      <p><strong>Goal:</strong> Be the first to empty your hand, then race to <strong>100 points</strong> across rounds.</p>
      <p>On your turn, play a card that matches the top of the discard pile by <strong>suit or rank</strong>.</p>
      <p><strong>Eights are wild</strong> — play one anytime and choose the suit that comes next.</p>
      <p>If you can't play, draw from the stock until you can, or pass when the stock runs out.</p>
      <p><strong>Scoring:</strong> When a player goes out, they score the value of the cards left in the opponent's hand. Eights = 50, 10/J/Q/K = 10, Ace = 1, others = face value.</p>
    `,
  },
  {
    slug: "cuttle",
    name: "Cuttle",
    family: "misc",
    players: "2",
    deck: "standard 52",
    complexity: 4,
    playableId: "cuttle",
    rulesHtml: `
      <p><strong>Goal:</strong> Be first to have <strong>21 points</strong> of number cards on your field. Each turn, take exactly one action.</p>
      <p><strong>Points:</strong> Play a number card (A–10) face-up for its value. <strong>Scuttle:</strong> play a number card on an opponent's lower point card to scrap both (ties broken by suit ♣&lt;♦&lt;♥&lt;♠).</p>
      <p><strong>Royals:</strong> <strong>King</strong> lowers your win target (14 / 10 / 5 / 0 for 1–4 kings). <strong>Queen</strong> protects your other cards from Twos, Nines and Jacks. <strong>Jack</strong> steals an opponent's point card. <strong>Glasses (8)</strong> reveals their hand.</p>
      <p><strong>One-offs</strong> (resolve, then scrap): <strong>A</strong> scrap all points · <strong>2</strong> scrap a royal <em>or</em> counter a one-off · <strong>3</strong> take a card from the scrap · <strong>4</strong> opponent discards two · <strong>5</strong> draw three · <strong>6</strong> scrap all royals · <strong>7</strong> dig the deck and play a card · <strong>9</strong> bounce a card back to hand.</p>
      <p><strong>Counters:</strong> A Two can counter any one-off — and a Two can counter a Two. The effect lands only if an even number of Twos end the stack.</p>
    `,
  },
  {
    slug: "hearts",
    name: "Hearts",
    aka: ["Black Lady", "Black Maria"],
    chapter: 14,
    family: "hearts",
    players: "4",
    deck: "standard 52",
    complexity: 3,
    bookPage: 263,
    playableId: "hearts",
    rulesHtml: `
      <p><strong>Goal:</strong> Have the <strong>lowest score</strong> when any player reaches 100.</p>
      <p><strong>Passing:</strong> Pass 3 cards each round (left, right, across, then no pass — repeating).</p>
      <p><strong>Play:</strong> The 2♣ leads the first trick. Follow suit if possible. Highest card of the led suit wins the trick.</p>
      <p><strong>Scoring:</strong> Each ♥ = 1 point. Q♠ = 13 points. Hearts can't be led until broken (played on another suit).</p>
      <p><strong>Shoot the Moon:</strong> Take all 26 penalty points and everyone else gets 26 instead.</p>
    `,
  },
  {
    slug: "euchre",
    name: "Euchre",
    chapter: 13,
    family: "euchre",
    players: "4 (partners)",
    deck: "24 cards (9–A)",
    complexity: 3,
    bookPage: 236,
    playableId: "euchre",
    rulesHtml: `
      <p><strong>Goal:</strong> Be the first team to <strong>10 points</strong>. You and <strong>Partner</strong> (across) play against Left and Right.</p>
      <p><strong>Deck:</strong> 24 cards (9 → Ace). Each player gets 5; one card is turned up.</p>
      <p><strong>Trump &amp; bowers:</strong> The <strong>right bower</strong> (Jack of trump) is the highest card; the <strong>left bower</strong> (other Jack of the same color) is second-highest and counts as trump. Then A, K, Q, 10, 9 of trump.</p>
      <p><strong>Bidding:</strong> Round 1 — order up the turned card to make its suit trump (the dealer picks it up). Round 2 — if all pass, name any other suit. The dealer is stuck and must name a suit if it passes around again.</p>
      <p><strong>Going alone:</strong> The maker may play alone — partner sits out — for a bigger reward.</p>
      <p><strong>Scoring:</strong> Makers take 3–4 tricks = 1, all 5 = 2 (alone = 4). Fail to take 3 and the defenders are <strong>euchred</strong> for 2.</p>
    `,
  },
];
