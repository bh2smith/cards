import type { GameManifest } from "../types";

export const baccaratManifest: GameManifest = {
  id: "baccarat",
  title: "Baccarat",
  blurb: "Player or Banker — the tableau decides the rest. Nine wins.",
  category: "Head-to-Head",
  load: async () => {
    const { BaccaratUI } = await import("./ui");
    return () => new BaccaratUI();
  },
};
