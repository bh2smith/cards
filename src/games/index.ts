import type { GameManifest } from "./types";
import { golfManifest } from "./golf/manifest";
import { pyramidManifest } from "./pyramid/manifest";
import { klondikeManifest } from "./klondike/manifest";
import { freecellManifest } from "./freecell/manifest";
import { cribbageManifest } from "./cribbage/manifest";
import { ginManifest } from "./gin/manifest";
import { rummyManifest } from "./rummy/manifest";
import { blackjackManifest } from "./blackjack/manifest";
import { crazyEightsManifest } from "./crazy-eights/manifest";
import { cuttleManifest } from "./cuttle/manifest";
import { heartsManifest } from "./hearts/manifest";
import { euchreManifest } from "./euchre/manifest";
import { spadesManifest } from "./spades/manifest";
import { warManifest } from "./war/manifest";
import { goFishManifest } from "./go-fish/manifest";
import { oldMaidManifest } from "./old-maid/manifest";
import { michiganManifest } from "./michigan/manifest";

/** Order within a category is the lobby display order. */
export const GAMES: GameManifest[] = [
  golfManifest,
  pyramidManifest,
  klondikeManifest,
  freecellManifest,
  cribbageManifest,
  ginManifest,
  rummyManifest,
  blackjackManifest,
  crazyEightsManifest,
  cuttleManifest,
  heartsManifest,
  euchreManifest,
  spadesManifest,
  warManifest,
  goFishManifest,
  oldMaidManifest,
  michiganManifest,
];
