import type { GameManifest } from "../types";

export const spadesManifest: GameManifest = {
  id: "spades",
  title: "Spades",
  blurb: "Bid and take tricks with your partner. Spades are always trump.",
  category: "Trick-Taking",
  load: async () => {
    const { SpadesUI } = await import("./ui");
    return () => new SpadesUI();
  },
};
