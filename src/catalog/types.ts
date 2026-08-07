export interface CatalogEntry {
  slug: string;
  name: string;
  /** Alternate names, searchable. */
  aka?: string[];
  /** Scarne chapter number; absent = a house game not in the encyclopedia. */
  chapter?: number;
  /** Mechanical family key — matches the engine's route id where one exists. */
  family: string;
  players: string;
  deck: string;
  complexity: 1 | 2 | 3 | 4 | 5;
  /** Page in Scarne's Encyclopedia of Card Games (citation only). */
  bookPage?: number;
  /** Original prose in Goal/Deal/Play/Scoring format — never text from the book. */
  rulesHtml: string;
  /** Route id when a family engine implements this game. */
  playableId?: string;
  /** Preset on that engine, when the game is a named variant. */
  presetId?: string;
}
