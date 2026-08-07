import type { Destroyable } from "../shared/types";
import type { GameIdValue } from "../shared/circles/leaderboard";

export type GameCategory =
  | "Solitaire"
  | "Head-to-Head"
  | "Trick-Taking"
  | "Family & Kids";

export interface GameManifest {
  id: string;
  title: string;
  blurb: string;
  category: GameCategory;
  /** On-chain leaderboard id. Absent = playable but results are not reported. */
  gameId?: GameIdValue;
  /** Leaderboard ranking mode: solo (cards remaining) vs head-to-head (net wins). */
  solo?: boolean;
  /** Leaderboard tab label when it differs from the lobby title. */
  tabLabel?: string;
  /** Rules catalog slug when it differs from the game id. */
  catalogSlug?: string;
  comingSoon?: boolean;
  /** Lazy UI factory — the game's chunk loads only when the route opens. */
  load?: () => Promise<() => Destroyable>;
}
