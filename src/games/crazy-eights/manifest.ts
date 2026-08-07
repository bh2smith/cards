import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const crazyEightsManifest: GameManifest = {
  id: "crazy-eights",
  title: "Crazy Eights",
  blurb:
    "Match the suit or rank. Play an eight to change suits. First to empty wins.",
  category: "Head-to-Head",
  gameId: GameId.CrazyEights,
  load: async () => {
    const { CrazyEightsUI } = await import("./ui");
    return () => new CrazyEightsUI();
  },
};
