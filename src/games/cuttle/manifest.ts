import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const cuttleManifest: GameManifest = {
  id: "cuttle",
  title: "Cuttle",
  blurb:
    "A card duel. Race to 21 points while one-offs and royals disrupt your foe.",
  category: "Head-to-Head",
  gameId: GameId.Cuttle,
  load: async () => {
    const { CuttleUI } = await import("./ui");
    return () => new CuttleUI();
  },
};
