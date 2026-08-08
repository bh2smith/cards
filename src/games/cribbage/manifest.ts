import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const cribbageManifest: GameManifest = {
  id: "cribbage",
  title: "Cribbage",
  blurb:
    "Score points through pegging and showing your hand. First to 121 wins.",
  category: "Head-to-Head",
  gameId: GameId.Cribbage,
  load: async () => {
    const { CribbageUI } = await import("./ui");
    return () => new CribbageUI();
  },
};
