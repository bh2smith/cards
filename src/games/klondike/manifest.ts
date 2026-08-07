import type { GameManifest } from "../types";
import { GameId } from "../../shared/circles/leaderboard";

export const klondikeManifest: GameManifest = {
  id: "klondike",
  title: "Klondike",
  blurb: "The classic. Build four foundation piles from Ace to King by suit.",
  category: "Solitaire",
  gameId: GameId.Klondike,
  solo: true,
  load: async () => {
    const { KlondikeUI } = await import("./ui");
    return () => new KlondikeUI();
  },
};
