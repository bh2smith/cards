import type { GameManifest } from "../types";

export const aceyDeuceyManifest: GameManifest = {
  id: "acey-deucey",
  title: "Acey-Deucey",
  blurb: "Two cards up, one in between. Watch out for the post.",
  category: "Head-to-Head",
  load: async () => {
    const { AceyDeuceyUI } = await import("./ui");
    return () => new AceyDeuceyUI();
  },
};
