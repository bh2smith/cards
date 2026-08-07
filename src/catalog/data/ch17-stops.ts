import type { CatalogEntry } from "../types";

/**
 * Chapter 17 — The Stops Games.
 * Original prose; bookPage cites where Scarne covers each game.
 */
export const CH17_STOPS: CatalogEntry[] = [
  {
    slug: "michigan",
    name: "Michigan",
    aka: ["Boodle", "Newmarket", "Chicago"],
    chapter: 17,
    family: "stops",
    players: "3–8",
    deck: "standard 52 + boodle layout",
    complexity: 2,
    bookPage: 329,
    playableId: "michigan",
    rulesHtml: `
      <p><strong>Goal:</strong> Empty your hand first and collect chips from the boodle cards along the way.</p>
      <p><strong>Setup:</strong> Four <strong>boodle cards</strong> — A♥, K♣, Q♦, J♠ — form the payout layout. Everyone antes a chip on each (the dealer antes two). The deck is dealt out with one extra <em>dead hand</em>; the dealer may swap their hand for it, sight unseen.</p>
      <p><strong>Play:</strong> The leader plays their lowest card of a chosen suit. Whoever holds the next rank in that suit plays it, and so on up the ladder until the Ace lands or the run hits a <strong>stop</strong> (the next card is buried in the dead hand). Whoever played last starts a fresh run in an opposite-color suit.</p>
      <p><strong>Boodle:</strong> Playing a layout card exactly (rank and suit) wins all the chips sitting on it.</p>
      <p><strong>Hand end:</strong> First player out of cards collects one chip per card left in each opponent's hand. Unclaimed boodle chips carry over.</p>
    `,
  },
  {
    slug: "fan-tan",
    name: "Fan Tan",
    aka: ["Card Dominoes", "Sevens", "Parliament"],
    chapter: 17,
    family: "stops",
    players: "3–8",
    deck: "standard 52",
    complexity: 2,
    bookPage: 331,
    playableId: "michigan",
    presetId: "fan-tan",
    rulesHtml: `
      <p><strong>Goal:</strong> Be first to play out your whole hand.</p>
      <p><strong>Setup:</strong> Everyone antes a chip to the pot; the whole deck is dealt out.</p>
      <p><strong>Play:</strong> Sevens start their suit's row in the middle. On your turn, play a seven or extend any row by exactly one rank — up toward the King or down toward the Ace, in suit. If you have no legal play, pay a chip to the pot and pass. If you can play, you must.</p>
      <p><strong>Strategy:</strong> Holding back a seven or a connecting card can lock opponents out — but every turn you sit on it, your own low and high cards stay stuck too.</p>
      <p><strong>Win:</strong> First out takes the pot, plus a chip per card left in each opponent's hand.</p>
    `,
  },
  {
    slug: "play-or-pay",
    name: "Play or Pay",
    chapter: 17,
    family: "stops",
    players: "3–8",
    deck: "standard 52",
    complexity: 1,
    playableId: "michigan",
    presetId: "play-or-pay",
    rulesHtml: `
      <p><strong>Goal:</strong> Shed every card before your opponents.</p>
      <p><strong>Setup:</strong> Ante a chip each; deal out the whole deck.</p>
      <p><strong>Play:</strong> The leader plays any card. Going around the table, each player must play the <strong>next rank in that suit</strong> — the sequence runs round-the-corner (…Queen, King, Ace, Two…) — or pay a chip to the pot.</p>
      <p><strong>New suit:</strong> When all thirteen cards of the suit are down, the player who completed it leads any card of a fresh suit.</p>
      <p><strong>Win:</strong> First player out of cards takes the pot, plus a chip per card left in each hand.</p>
    `,
  },
  {
    slug: "crazy-jacks",
    name: "Crazy Jacks",
    chapter: 17,
    family: "stops",
    players: "2–5",
    deck: "standard 52",
    complexity: 1,
    bookPage: 334,
    playableId: "crazy-eights",
    presetId: "crazy-jacks",
    rulesHtml: `
      <p><strong>Goal:</strong> Exactly Crazy Eights — but the <strong>Jacks</strong> are the wild cards.</p>
      <p>Match the top discard by suit or rank; play a Jack anytime to name the next suit. Eights are ordinary cards here.</p>
      <p><strong>Scoring:</strong> When someone goes out, cards left in opposing hands score against them — Jacks are the 50-point millstone.</p>
    `,
  },
];
