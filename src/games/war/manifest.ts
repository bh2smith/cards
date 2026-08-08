import type { GameManifest } from "../types";

export const warManifest: GameManifest = {
  id: "war",
  title: "War",
  blurb: "Flip for the high card. Win wars to capture the whole deck.",
  category: "Family & Kids",
  load: async () => {
    const { WarUI } = await import("./ui");
    return () => new WarUI();
  },
};
