import { router } from "./shared/router";
import { CribbageUI } from "./games/cribbage/ui";

router.register(
  "cribbage",
  "Cribbage",
  "Score points through pegging and showing your hand. First to 121 wins.",
  () => new CribbageUI(),
);

router.init();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
