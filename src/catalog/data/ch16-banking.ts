import type { CatalogEntry } from "../types";

/**
 * Chapter 16 — Banking Card Games. (Blackjack lives in existing-games.ts.)
 * Original prose; bookPage cites Scarne's coverage. Play-money only.
 */
export const CH16_BANKING: CatalogEntry[] = [
  {
    slug: "baccarat",
    name: "Baccarat",
    aka: ["Punto Banco"],
    chapter: 16,
    family: "banking",
    players: "any vs the bank",
    deck: "six-deck shoe",
    complexity: 2,
    playableId: "baccarat",
    rulesHtml: `
      <p><strong>Goal:</strong> Bet on which side — <strong>Player</strong> or <strong>Banker</strong> — will finish closer to <strong>nine</strong>. Or bet the Tie, if you enjoy long odds.</p>
      <p><strong>Values:</strong> Tens and faces count zero, aces one, others pip; totals keep only the last digit (7+8 = 5).</p>
      <p><strong>Play:</strong> Two cards each side. Naturals of 8 or 9 end it. Otherwise a fixed table — no choices — decides who draws a third card.</p>
      <p><strong>Payouts:</strong> Player even money; Banker even money less a 5% commission; Tie 8:1.</p>
      <p>The purest banking game there is: all ritual, no decisions, and the ritual is magnificent.</p>
    `,
  },
  {
    slug: "chemin-de-fer",
    name: "Chemin de Fer",
    aka: ["Chemmy", "Shimmy"],
    chapter: 16,
    family: "banking",
    players: "3+",
    deck: "six-deck shoe",
    complexity: 3,
    bookPage: 292,
    playableId: "baccarat",
    presetId: "chemin-de-fer",
    rulesHtml: `
      <p><strong>Goal:</strong> Baccarat where the <strong>bank travels</strong>. Players take turns holding it, staking their own money against the table.</p>
      <p>The punter facing the bank has the game's one legal decision: draw or stand on a two-card five. Everything else follows the tableau.</p>
      <p>A winning banker may keep the bank and let the stake ride; a loss passes the shoe to the next seat. The casino classic of the Riviera — and of every Bond novel.</p>
    `,
  },
  {
    slug: "red-dog",
    name: "Red Dog",
    aka: ["High Card Pool"],
    chapter: 16,
    family: "banking",
    players: "any vs the bank",
    deck: "standard 52",
    complexity: 1,
    bookPage: 319,
    playableId: "red-dog",
    rulesHtml: `
      <p><strong>Goal:</strong> Two cards are dealt; bet on whether the third will fall strictly <strong>between</strong> them.</p>
      <p>Consecutive cards push. A pair pays 11:1 if the third card matches it. Otherwise the <strong>spread</strong> sets the odds — a one-card gap pays 5:1, two pays 4:1, three pays 2:1, four or more even money — and you may double your bet before the reveal.</p>
      <p>Narrow spreads are where the bank earns its keep.</p>
    `,
  },
  {
    slug: "acey-deucey",
    name: "Acey-Deucey",
    aka: ["In-Between", "Between the Sheets"],
    chapter: 16,
    family: "banking",
    players: "2+",
    deck: "standard 52",
    complexity: 1,
    bookPage: 315,
    playableId: "acey-deucey",
    rulesHtml: `
      <p><strong>Goal:</strong> Two bracket cards are dealt; you set your bet <em>after</em> seeing them, then a third card decides.</p>
      <p>Strictly between the brackets wins even money; outside loses. A first-card ace is called high or low before the second card lands.</p>
      <p><strong>The post:</strong> If the third card <em>matches</em> a bracket card, you lose <strong>double</strong>. That rule has ruined more confident bettors than any spread ever did.</p>
    `,
  },
  {
    slug: "faro",
    name: "Faro",
    aka: ["Farobank", "Bucking the Tiger"],
    chapter: 16,
    family: "banking",
    players: "any vs the bank",
    deck: "standard 52",
    complexity: 3,
    bookPage: 304,
    playableId: "faro",
    rulesHtml: `
      <p><strong>Goal:</strong> Back ranks on the layout against the bank, two cards at a time.</p>
      <p>Each <strong>turn</strong> exposes a banker's card (bets on that rank lose) then a player's card (bets on that rank win). Unresolved bets ride. <strong>Copper</strong> a bet to reverse its polarity and back the bank's card instead.</p>
      <p><strong>Splits:</strong> both cards of one rank — the bank takes half your bet. The <strong>casekeeper</strong> tracks how many of each rank remain; counting cases is the whole skill.</p>
      <p>The game that built and emptied the saloons of the Old West.</p>
    `,
  },
  {
    slug: "pontoon",
    name: "Pontoon",
    aka: ["Vingt-et-Un"],
    chapter: 16,
    family: "banking",
    players: "2–8",
    deck: "standard 52",
    complexity: 2,
    bookPage: 288,
    rulesHtml: `
      <p><strong>Goal:</strong> The British parlor ancestor of blackjack — beat the banker's total without passing 21.</p>
      <p>Both dealer cards stay hidden; ties go to the bank. A five-card hand under 21 (the "five-card trick") beats everything but a pontoon, and twisting (hitting) versus buying (raising while hitting) gives the bettor more textures than the casino game allows.</p>
      <p>A pontoon — ace and a ten — usually wins the deal itself: the bank passes to whoever shows one.</p>
    `,
  },
  {
    slug: "seven-and-a-half",
    name: "Seven and a Half",
    chapter: 16,
    family: "banking",
    players: "2–8",
    deck: "40 cards (no 8s, 9s, 10s)",
    complexity: 1,
    bookPage: 290,
    rulesHtml: `
      <p><strong>Goal:</strong> Italy's blackjack, played to <strong>7½</strong> with the 40-card deck.</p>
      <p>Pip cards count face value; face cards count half a point. Draw as you dare — pass 7½ and you bust. The King of Diamonds is wild.</p>
      <p>Faster and meaner than 21: with the target this low, one draw is brave and two is a lifestyle.</p>
    `,
  },
  {
    slug: "banker-and-broker",
    name: "Banker and Broker",
    aka: ["Dutch Bank", "Blind Hookey"],
    chapter: 16,
    family: "banking",
    players: "2+",
    deck: "standard 52",
    complexity: 1,
    bookPage: 317,
    rulesHtml: `
      <p><strong>Goal:</strong> Cut the deck into piles; players bet on any pile, the banker keeps one. Highest bottom card wins.</p>
      <p>Aces high, ties to the bank. That's the entire game — the fastest way ever devised to move money around a table.</p>
    `,
  },
  {
    slug: "card-craps",
    name: "Card Craps",
    chapter: 16,
    family: "banking",
    players: "2+",
    deck: "48 cards (A–6 ×2 suits ×4)",
    complexity: 2,
    bookPage: 321,
    rulesHtml: `
      <p><strong>Goal:</strong> Craps without dice — two cards drawn from a deck of aces through sixes stand in for the roll.</p>
      <p>Pass and don't-pass bets resolve exactly as at the dice table: naturals, craps, and points made or missed, with the deck reshuffled between rolls to keep the odds honest.</p>
      <p>Born wherever dice were illegal but cards were not.</p>
    `,
  },
  {
    slug: "put-and-take",
    name: "Put and Take",
    chapter: 16,
    family: "banking",
    players: "2–8",
    deck: "standard 52",
    complexity: 1,
    bookPage: 323,
    rulesHtml: `
      <p><strong>Goal:</strong> A dealt hand of five cards, then two rounds against the turn of the deck: first you <strong>put</strong> chips in when the turned card matches one of yours, then you <strong>take</strong> chips out on the same matches.</p>
      <p>Stakes escalate each turn (one, two, four, eight, sixteen). Pure luck, maximum table noise.</p>
    `,
  },
];
