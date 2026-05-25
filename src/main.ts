import { router } from "./shared/router";
import { CribbageUI } from "./games/cribbage/ui";
import { GolfUI } from "./games/golf/ui";
import { BlackjackUI } from "./games/blackjack/ui";
import { PyramidUI } from "./games/pyramid/ui";
import { GinRummyUI } from "./games/gin/ui";
import { HeartsUI } from "./games/hearts/ui";
import { KlondikeUI } from "./games/klondike/ui";
import { initMiniapp } from "./shared/circles/miniapp";
import { withEntryGate } from "./shared/circles/entryGate";
import { GameId } from "./shared/circles/leaderboard";
import { mountSettings } from "./shared/ui/settings-modal";

initMiniapp();
mountSettings();

router.register(
  "cribbage",
  "Cribbage",
  "Score points through pegging and showing your hand. First to 121 wins.",
  withEntryGate(GameId.Cribbage, () => new CribbageUI()),
);

router.register(
  "golf",
  "Golf Solitaire",
  "Clear the tableau by playing cards one rank above or below the waste top.",
  withEntryGate(GameId.Golf, () => new GolfUI()),
);

router.register(
  "blackjack",
  "Blackjack",
  "Beat the dealer. Get as close to 21 as you can without going bust.",
  withEntryGate(GameId.Blackjack, () => new BlackjackUI()),
);

router.register(
  "pyramid",
  "Pyramid",
  "Pair exposed cards that sum to 13 to clear the pyramid.",
  withEntryGate(GameId.Pyramid, () => new PyramidUI()),
);

router.register(
  "gin",
  "Gin Rummy",
  "Form melds and knock before the bot does. Score runs and sets.",
  withEntryGate(GameId.GinRummy, () => new GinRummyUI()),
);

router.register(
  "hearts",
  "Hearts",
  "Avoid hearts and the queen of spades across 4 players.",
  withEntryGate(GameId.Hearts, () => new HeartsUI()),
);

router.register(
  "klondike",
  "Klondike",
  "The classic. Build four foundation piles from Ace to King by suit.",
  withEntryGate(() => new KlondikeUI()),
);

router.init();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
