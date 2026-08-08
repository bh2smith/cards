import type { GameManifest } from "../types";

export const rummyManifest: GameManifest = {
  id: "rummy",
  title: "Rummy",
  blurb:
    "The classic draw-and-meld family — five ways to play, from Straight to 500 Rum.",
  category: "Head-to-Head",
  catalogSlug: "straight-rummy",
  load: async () => {
    const { RummyUI } = await import("./ui");
    return () => new RummyUI();
  },
};
