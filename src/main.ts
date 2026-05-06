import { router } from "./shared/router";
import { CribbageUI } from "./games/cribbage/ui";
import { GolfUI } from "./games/golf/ui";
import { BlackjackUI } from "./games/blackjack/ui";
import { PyramidUI } from "./games/pyramid/ui";
import { initMiniapp } from "./shared/circles/miniapp";
import { withEntryGate } from "./shared/circles/entryGate";

initMiniapp();

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

router.init();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
