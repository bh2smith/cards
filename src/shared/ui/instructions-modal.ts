const INSTRUCTIONS: Record<string, { title: string; html: string }> = {
  golf: {
    title: "Golf Solitaire",
    html: `
      <p><strong>Goal:</strong> Clear all cards from the tableau.</p>
      <p>Play cards from the bottom of each column onto the waste pile if they are <strong>one rank above or below</strong> the current waste card. Ranks wrap (King → Ace → Two).</p>
      <p>If no moves are available, draw from the stock. The game ends when the stock is empty and no more moves remain.</p>
      <p><strong>Win:</strong> Remove every card from the tableau.</p>
    `,
  },
  pyramid: {
    title: "Pyramid",
    html: `
      <p><strong>Goal:</strong> Clear all cards from the pyramid.</p>
      <p>Remove pairs of <strong>exposed</strong> cards that add up to <strong>13</strong>. Kings (value 13) are removed alone.</p>
      <p>Card values: A=1, 2–10 face value, J=11, Q=12, K=13.</p>
      <p>A card is exposed when no cards overlap it from the row below. Draw from the stock when stuck.</p>
      <p><strong>Win:</strong> Remove every card from the pyramid.</p>
    `,
  },
  cribbage: {
    title: "Cribbage",
    html: `
      <p><strong>Goal:</strong> Be the first to reach <strong>121 points</strong>.</p>
      <p><strong>Deal:</strong> Each player gets 6 cards and discards 2 to the crib. The crib scores for the dealer.</p>
      <p><strong>Pegging:</strong> Alternate playing cards, counting toward 31. Score points for pairs, runs, and hitting 15 or 31.</p>
      <p><strong>Showing:</strong> After pegging, score your hand using the starter card — pairs, runs, fifteens, and flushes all count.</p>
      <p>The dealer alternates each round.</p>
    `,
  },
  blackjack: {
    title: "Blackjack",
    html: `
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
  gin: {
    title: "Gin Rummy",
    html: `
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
  klondike: {
    title: "Klondike Solitaire",
    html: `
      <p><strong>Goal:</strong> Move all 52 cards to the four foundation piles, building each suit up from Ace to King.</p>
      <p><strong>Tableau:</strong> Build down in <strong>alternating colors</strong> (red on black, black on red). Move single cards or sequences. Empty columns accept only Kings.</p>
      <p><strong>Stock:</strong> Draw cards to the waste pile. Play the top waste card to the tableau or foundations.</p>
      <p><strong>Flip:</strong> When a face-down card is uncovered, it automatically turns face-up.</p>
      <p><strong>Win:</strong> All four foundations built from Ace to King.</p>
    `,
  },
  "crazy-eights": {
    title: "Crazy Eights",
    html: `
      <p><strong>Goal:</strong> Be the first to empty your hand, then race to <strong>100 points</strong> across rounds.</p>
      <p>On your turn, play a card that matches the top of the discard pile by <strong>suit or rank</strong>.</p>
      <p><strong>Eights are wild</strong> — play one anytime and choose the suit that comes next.</p>
      <p>If you can't play, draw from the stock until you can, or pass when the stock runs out.</p>
      <p><strong>Scoring:</strong> When a player goes out, they score the value of the cards left in the opponent's hand. Eights = 50, 10/J/Q/K = 10, Ace = 1, others = face value.</p>
    `,
  },
  freecell: {
    title: "Freecell",
    html: `
      <p><strong>Goal:</strong> Move all 52 cards to the four foundation piles, building each suit up from Ace to King.</p>
      <p>All cards are dealt face-up into <strong>8 columns</strong> — every move is in plain sight.</p>
      <p><strong>Tableau:</strong> Build down in <strong>alternating colors</strong>. Move a single card, or a sequence if you have enough room.</p>
      <p><strong>Free cells:</strong> Four cells each hold one card as temporary storage. The number of free cells (and empty columns) limits how large a sequence you can move at once.</p>
      <p><strong>Deals are numbered</strong> — the same number always deals the same game, so you can replay or share a deal. Use Undo and Restart freely.</p>
    `,
  },
  hearts: {
    title: "Hearts",
    html: `
      <p><strong>Goal:</strong> Have the <strong>lowest score</strong> when any player reaches 100.</p>
      <p><strong>Passing:</strong> Pass 3 cards each round (left, right, across, then no pass — repeating).</p>
      <p><strong>Play:</strong> The 2♣ leads the first trick. Follow suit if possible. Highest card of the led suit wins the trick.</p>
      <p><strong>Scoring:</strong> Each ♥ = 1 point. Q♠ = 13 points. Hearts can't be led until broken (played on another suit).</p>
      <p><strong>Shoot the Moon:</strong> Take all 26 penalty points and everyone else gets 26 instead.</p>
    `,
  },
};

let backdrop: HTMLElement | null = null;

export function openInstructions(gameId: string): void {
  if (backdrop) return;
  const info = INSTRUCTIONS[gameId];
  if (!info) return;

  backdrop = document.createElement("div");
  backdrop.className = "instructions-backdrop";
  backdrop.innerHTML = `
    <div class="instructions-modal" role="dialog" aria-label="How to Play">
      <div class="instructions-header">
        <h2>${info.title}</h2>
        <button id="instructions-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="instructions-body">${info.html}</div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeInstructions();
  });
  backdrop
    .querySelector("#instructions-close")
    ?.addEventListener("click", closeInstructions);
  document.addEventListener("keydown", onKeyDown);
}

function closeInstructions(): void {
  if (!backdrop) return;
  backdrop.remove();
  backdrop = null;
  document.removeEventListener("keydown", onKeyDown);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeInstructions();
}
