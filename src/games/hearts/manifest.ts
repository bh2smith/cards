import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const heartsManifest: GameManifest = {
  id: "hearts",
  title: "Hearts",
  blurb: "Avoid hearts and the queen of spades across 4 players.",
  category: "Trick-Taking",
  gameId: GameId.Hearts,
  load: async () => {
    const { HeartsUI } = await import("./ui");
    return () => new HeartsUI();
  },
};
