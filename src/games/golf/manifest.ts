import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const golfManifest: GameManifest = {
  id: "golf",
  title: "Golf Solitaire",
  blurb:
    "Clear the tableau by playing cards one rank above or below the waste top.",
  category: "Solitaire",
  gameId: GameId.Golf,
  solo: true,
  tabLabel: "Golf",
  load: async () => {
    const { GolfUI } = await import("./ui");
    return () => new GolfUI();
  },
};
