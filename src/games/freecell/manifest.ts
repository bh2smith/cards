import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const freecellManifest: GameManifest = {
  id: "freecell",
  title: "Freecell",
  blurb:
    "All cards face-up. Use four free cells to maneuver cards to the foundations.",
  category: "Solitaire",
  gameId: GameId.Freecell,
  solo: true,
  load: async () => {
    const { FreecellUI } = await import("./ui");
    return () => new FreecellUI();
  },
};
