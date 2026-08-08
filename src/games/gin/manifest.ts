import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const ginManifest: GameManifest = {
  id: "gin",
  title: "Gin Rummy",
  blurb: "Form melds and knock before the bot does. Score runs and sets.",
  category: "Head-to-Head",
  gameId: GameId.GinRummy,
  load: async () => {
    const { GinRummyUI } = await import("./ui");
    return () => new GinRummyUI();
  },
};
