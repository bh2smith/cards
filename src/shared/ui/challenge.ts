import { challengeUrl, type Challenge } from "../challenge";
import { resolveProfiles } from "../circles/miniapp";

const GAME_LABELS: Record<string, string> = {
  golf: "Golf Solitaire",
  pyramid: "Pyramid",
  klondike: "Klondike",
  freecell: "Freecell",
};

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function challengerName(c: Challenge, profileName?: string): string {
  return profileName ?? (c.by ? shortAddr(c.by) : "A friend");
}

function bannerText(c: Challenge, profileName?: string): string {
  const who = challengerName(c, profileName);
  return c.cardsRemaining === 0
    ? `${who} cleared this deal — match their perfect run.`
    : `${who} left ${c.cardsRemaining} cards on this deal. Beat it.`;
}

/** Show the incoming-challenge banner under the game header. */
export function showChallengeBanner(c: Challenge): void {
  if (document.getElementById("challenge-banner")) return;
  const header = document.querySelector(".header");
  if (!header) return;

  header.insertAdjacentHTML(
    "afterend",
    `<div class="challenge-banner" id="challenge-banner">
      <span class="challenge-banner-icon">⚔</span>
      <span id="challenge-banner-text"></span>
    </div>`,
  );
  document.getElementById("challenge-banner-text")!.textContent = bannerText(c);

  if (c.by) {
    const by = c.by;
    resolveProfiles([by]).then((profiles) => {
      const el = document.getElementById("challenge-banner-text");
      const banner = document.getElementById("challenge-banner");
      const name = profiles.get(by.toLowerCase())?.name;
      if (el && name && !banner?.dataset.done) {
        el.textContent = bannerText(c, name);
      }
    });
  }
}

/** Flip the banner to a verdict once the game is over. Idempotent. */
export function showChallengeOutcome(c: Challenge, myCards: number): void {
  const banner = document.getElementById("challenge-banner");
  const text = document.getElementById("challenge-banner-text");
  if (!banner || !text || banner.dataset.done) return;
  banner.dataset.done = "1";

  const theirs = c.cardsRemaining;
  let verdict: string;
  let won = false;
  if (theirs === 0) {
    won = myCards === 0;
    verdict = won
      ? "You matched the perfect clear!"
      : `They cleared it — you left ${myCards}.`;
  } else if (myCards < theirs) {
    won = true;
    verdict = `Challenge beaten — ${myCards} vs ${theirs} cards!`;
  } else if (myCards === theirs) {
    verdict = `Dead heat — ${theirs} cards apiece.`;
  } else {
    verdict = `Challenge stands — they left ${theirs}, you left ${myCards}.`;
  }
  banner.classList.add(won ? "challenge-won" : "challenge-lost");
  text.textContent = verdict;
}

/** Add a share button to the action area once the game is over. Idempotent. */
export function showChallengeShare(c: Challenge): void {
  if (document.getElementById("challenge-share-btn")) return;
  const area = document.querySelector(".action-area");
  if (!area) return;

  const btn = document.createElement("button");
  btn.id = "challenge-share-btn";
  btn.className = "challenge-share-btn";
  btn.textContent = "Challenge a Friend";
  btn.addEventListener("click", async () => {
    const url = challengeUrl(c);
    const label = GAME_LABELS[c.game] ?? c.game;
    const text =
      c.cardsRemaining === 0
        ? `I cleared this ${label} deal in The Card Room. Match it!`
        : `I left ${c.cardsRemaining} cards on this ${label} deal in The Card Room. Beat it!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "The Card Room", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        flashLabel(btn, "Link Copied!");
      }
    } catch {
      // Share sheet dismissed, or clipboard blocked — try the fallback.
      try {
        await navigator.clipboard.writeText(url);
        flashLabel(btn, "Link Copied!");
      } catch {
        flashLabel(btn, "Couldn't copy link");
      }
    }
  });
  area.appendChild(btn);
}

function flashLabel(btn: HTMLButtonElement, label: string): void {
  btn.textContent = label;
  setTimeout(() => (btn.textContent = "Challenge a Friend"), 2000);
}

/** Remove challenge UI (used when a game re-deals in place). */
export function clearChallengeUi(): void {
  document.getElementById("challenge-banner")?.remove();
  document.getElementById("challenge-share-btn")?.remove();
}
