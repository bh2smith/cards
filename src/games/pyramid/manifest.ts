import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const pyramidManifest: GameManifest = {
  id: "pyramid",
  title: "Pyramid",
  blurb: "Pair exposed cards that sum to 13 to clear the pyramid.",
  category: "Solitaire",
  gameId: GameId.Pyramid,
  solo: true,
  load: async () => {
    const { PyramidUI } = await import("./ui");
    return () => new PyramidUI();
  },
};
