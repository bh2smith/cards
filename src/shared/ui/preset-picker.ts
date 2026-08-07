import type { FamilyDef } from "../engine/variant";

/**
 * A chip row linking each of a family's presets (plus the base rules) via the
 * `?preset=` hash query. Clicking re-routes, so the game re-instantiates with
 * the chosen config — games render this on their pre-deal or game-over screen.
 */
export function presetChipsHtml(
  gameId: string,
  def: FamilyDef<object>,
  active: string | undefined,
  baseLabel = "Classic",
): string {
  const chip = (href: string, label: string, isActive: boolean) =>
    `<a class="preset-chip ${isActive ? "active" : ""}" href="${href}">${label}</a>`;
  return `
    <div class="preset-chips">
      ${chip(`#/${gameId}`, baseLabel, active === undefined)}
      ${Object.entries(def.presets)
        .map(([id, p]) =>
          chip(`#/${gameId}?preset=${id}`, p.name, active === id),
        )
        .join("")}
    </div>
  `;
}
