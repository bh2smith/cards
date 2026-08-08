import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const blackjackManifest: GameManifest = {
  id: "blackjack",
  title: "Blackjack",
  blurb: "Beat the dealer. Get as close to 21 as you can without going bust.",
  category: "Head-to-Head",
  gameId: GameId.Blackjack,
  load: async () => {
    const { BlackjackUI } = await import("./ui");
    return () => new BlackjackUI();
  },
};
