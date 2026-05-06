import { router } from "./shared/router";
import { CribbageUI } from "./games/cribbage/ui";
import { GolfUI } from "./games/golf/ui";
import { BlackjackUI } from "./games/blackjack/ui";
import { PyramidUI } from "./games/pyramid/ui";

router.register(
  "cribbage",
  "Cribbage",
  "Score points through pegging and showing your hand. First to 121 wins.",
  () => new CribbageUI(),
);

router.register(
  "golf",
  "Golf Solitaire",
  "Clear the tableau by playing cards one rank above or below the waste top.",
  () => new GolfUI(),
);

router.register(
  "blackjack",
  "Blackjack",
  "Beat the dealer. Get as close to 21 as you can without going bust.",
  () => new BlackjackUI(),
);

router.register(
  "pyramid",
  "Pyramid",
  "Pair exposed cards that sum to 13 to clear the pyramid.",
  () => new PyramidUI(),
);

router.init();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
