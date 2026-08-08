import type { GameManifest } from "../types";

export const oldMaidManifest: GameManifest = {
  id: "old-maid",
  title: "Old Maid",
  blurb: "Pair off your cards and don't get stuck with the lonely Queen.",
  category: "Family & Kids",
  load: async () => {
    const { OldMaidUI } = await import("./ui");
    return () => new OldMaidUI();
  },
};
