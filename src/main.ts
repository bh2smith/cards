import { CribbageUI } from "./games/cribbage/ui";

new CribbageUI();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
