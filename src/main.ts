import { router } from "./shared/router";
import { CribbageUI } from "./games/cribbage/ui";
import { GolfUI } from "./games/golf/ui";
import { BlackjackUI } from "./games/blackjack/ui";
import { PyramidUI } from "./games/pyramid/ui";
import { GinRummyUI } from "./games/gin/ui";
import { HeartsUI } from "./games/hearts/ui";
import { KlondikeUI } from "./games/klondike/ui";
import { CrazyEightsUI } from "./games/crazy-eights/ui";
import { initMiniapp } from "./shared/circles/miniapp";
import { withEntryGate } from "./shared/circles/entryGate";
import { mountSettings } from "./shared/ui/settings-modal";
import { injectCardSprite } from "./shared/ui/cards";

initMiniapp();
mountSettings();
injectCardSprite();

router.register(
  "cribbage",
  "Cribbage",
  "Score points through pegging and showing your hand. First to 121 wins.",
  withEntryGate(() => new CribbageUI()),
);

router.register(
  "golf",
  "Golf Solitaire",
  "Clear the tableau by playing cards one rank above or below the waste top.",
  withEntryGate(() => new GolfUI()),
);

router.register(
  "blackjack",
  "Blackjack",
  "Beat the dealer. Get as close to 21 as you can without going bust.",
  withEntryGate(() => new BlackjackUI()),
);

router.register(
  "pyramid",
  "Pyramid",
  "Pair exposed cards that sum to 13 to clear the pyramid.",
  withEntryGate(() => new PyramidUI()),
);

router.register(
  "gin",
  "Gin Rummy",
  "Form melds and knock before the bot does. Score runs and sets.",
  withEntryGate(() => new GinRummyUI()),
);

router.register(
  "hearts",
  "Hearts",
  "Avoid hearts and the queen of spades across 4 players.",
  withEntryGate(() => new HeartsUI()),
);

router.register(
  "klondike",
  "Klondike",
  "The classic. Build four foundation piles from Ace to King by suit.",
  withEntryGate(() => new KlondikeUI()),
);

router.register(
  "crazy-eights",
  "Crazy Eights",
  "Match the suit or rank. Play an eight to change suits. First to empty wins.",
  withEntryGate(() => new CrazyEightsUI()),
);

router.init();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
