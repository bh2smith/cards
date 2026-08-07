import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const euchreManifest: GameManifest = {
  id: "euchre",
  title: "Euchre",
  blurb:
    "Partnership trick-taking with bowers and trump. First team to 10 wins.",
  category: "Trick-Taking",
  gameId: GameId.Euchre,
  load: async () => {
    const { EuchreUI } = await import("./ui");
    return () => new EuchreUI();
  },
};
