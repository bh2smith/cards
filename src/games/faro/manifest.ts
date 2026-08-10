import type { GameManifest } from "../types";

export const faroManifest: GameManifest = {
  id: "faro",
  title: "Faro",
  blurb:
    "The Old West's table game — back a rank against the bank, turn by turn.",
  category: "Head-to-Head",
  load: async () => {
    const { FaroUI } = await import("./ui");
    return () => new FaroUI();
  },
};
