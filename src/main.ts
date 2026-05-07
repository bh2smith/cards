import { router } from "./shared/router";
import { CribbageUI } from "./games/cribbage/ui";
import { GolfUI } from "./games/golf/ui";
import { BlackjackUI } from "./games/blackjack/ui";
import { PyramidUI } from "./games/pyramid/ui";
import { GinRummyUI } from "./games/gin/ui";
import { HeartsUI } from "./games/hearts/ui";
import { initMiniapp } from "./shared/circles/miniapp";
import { withEntryGate } from "./shared/circles/entryGate";
import { mountSettings } from "./shared/ui/settings-modal";

initMiniapp();
mountSettings();

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

router.init();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
