import { router } from "./shared/router";
import { CribbageUI } from "./games/cribbage/ui";
import { GolfUI } from "./games/golf/ui";
import { BlackjackUI } from "./games/blackjack/ui";
import { PyramidUI } from "./games/pyramid/ui";
import { GinRummyUI } from "./games/gin/ui";
import { HeartsUI } from "./games/hearts/ui";
import { KlondikeUI } from "./games/klondike/ui";
import { CrazyEightsUI } from "./games/crazy-eights/ui";
import { FreecellUI } from "./games/freecell/ui";
import { CuttleUI } from "./games/cuttle/ui";
import { initMiniapp } from "./shared/circles/miniapp";
import { withEntryGate } from "./shared/circles/entryGate";
import { GameId } from "./shared/circles/leaderboard";
import { mountSettings } from "./shared/ui/settings-modal";
import { injectCardSprite } from "./shared/ui/cards";

initMiniapp();
mountSettings();
injectCardSprite();

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

router.register(
  "crazy-eights",
  "Crazy Eights",
  "Match the suit or rank. Play an eight to change suits. First to empty wins.",
  withEntryGate(() => new CrazyEightsUI()),
);

router.register(
  "freecell",
  "Freecell",
  "All cards face-up. Use four free cells to maneuver cards to the foundations.",
  withEntryGate(() => new FreecellUI()),
);

router.register(
  "cuttle",
  "Cuttle",
  "A combative duel. Race to 21 points with number cards while royals and one-off effects disrupt your opponent.",
  withEntryGate(() => new CuttleUI()),
);

router.init();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
