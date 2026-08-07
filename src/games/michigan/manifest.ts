import type { GameManifest } from "../types";

export const michiganManifest: GameManifest = {
  id: "michigan",
  title: "Michigan",
  blurb:
    "Race sequences to empty your hand — boodle cards pay chips. Fan Tan and Play or Pay included.",
  category: "Family & Kids",
  load: async () => {
    const { MichiganUI } = await import("./ui");
    return () => new MichiganUI();
  },
};
