export interface VariantPreset<Cfg> {
  name: string;
  overrides: Partial<Cfg>;
}

/**
 * A family engine's rule surface: one base config plus named variant presets.
 * The book's named games become presets; the engine takes a resolved config.
 */
export interface FamilyDef<Cfg> {
  base: Cfg;
  presets: Record<string, VariantPreset<Cfg>>;
}

/** Resolve a preset id (e.g. from a `?preset=` hash param) to a full config. */
export function resolvePreset<Cfg extends object>(
  def: FamilyDef<Cfg>,
  presetId?: string,
): Cfg {
  const preset = presetId ? def.presets[presetId] : undefined;
  return { ...def.base, ...(preset?.overrides ?? {}) };
}

/** The preset id in the current hash query, e.g. "#/poker?preset=seven-stud". */
export function presetFromHash(hash: string): string | undefined {
  const queryStart = hash.indexOf("?");
  if (queryStart < 0) return undefined;
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  return params.get("preset") ?? undefined;
}
