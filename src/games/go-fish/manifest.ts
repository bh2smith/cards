import type { GameManifest } from "../types";

export const goFishManifest: GameManifest = {
  id: "go-fish",
  title: "Go Fish",
  blurb: "Ask for ranks, fish the pond, and collect the most books of four.",
  category: "Family & Kids",
  load: async () => {
    const { GoFishUI } = await import("./ui");
    return () => new GoFishUI();
  },
};
