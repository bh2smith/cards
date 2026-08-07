import { router } from "./shared/router";
import { GAMES } from "./games";
import type { GameManifest } from "./games/types";
import type { Destroyable } from "./shared/types";
import { initCircles } from "./shared/circles/miniapp";
import { withEntryGate } from "./shared/circles/entryGate";
import { initChallenges } from "./shared/challenge";
import { mountSettings } from "./shared/ui/settings-modal";
import { mountLoginChip } from "./shared/ui/login-chip";
import { injectCardSprite } from "./shared/ui/cards";

initCircles();
initChallenges();
mountSettings();
mountLoginChip();
injectCardSprite();

function lazyFactory(
  load: NonNullable<GameManifest["load"]>,
): () => Destroyable {
  return () => {
    let inner: Destroyable | null = null;
    let destroyed = false;
    load().then((make) => {
      if (!destroyed) inner = make();
    });
    return {
      destroy() {
        destroyed = true;
        inner?.destroy?.();
        inner = null;
      },
    };
  };
}

for (const game of GAMES) {
  if (!game.load || game.comingSoon) continue;
  router.register(game.id, withEntryGate(lazyFactory(game.load)));
}

router.init();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
