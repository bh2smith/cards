import type { GameManifest } from "../types";

export const redDogManifest: GameManifest = {
  id: "red-dog",
  title: "Red Dog",
  blurb: "Bet on the spread — will the third card fall between?",
  category: "Head-to-Head",
  load: async () => {
    const { RedDogUI } = await import("./ui");
    return () => new RedDogUI();
  },
};
