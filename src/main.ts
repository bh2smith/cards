import { router } from "./shared/router";
import { CribbageUI } from "./games/cribbage/ui";
import { GolfUI } from "./games/golf/ui";

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

router.init();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
