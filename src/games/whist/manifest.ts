import type { GameManifest } from "../types";

export const whistManifest: GameManifest = {
  id: "whist",
  title: "Whist",
  blurb:
    "The grandfather of trick-taking — plus Knockout, Oh Hell, and Norwegian variants.",
  category: "Trick-Taking",
  catalogSlug: "whist",
  load: async () => {
    const { WhistUI } = await import("./ui");
    return () => new WhistUI();
  },
};
