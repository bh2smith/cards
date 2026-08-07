import type { CatalogEntry } from "./types";
import { getEntry, groupedEntries, searchEntries } from "./index";

function complexityDots(level: number): string {
  return "●".repeat(level) + "○".repeat(5 - level);
}

function metaChips(e: CatalogEntry): string {
  return `
    <span class="catalog-chip">${e.players} player${e.players === "1" ? "" : "s"}</span>
    <span class="catalog-chip">${e.deck}</span>
    <span class="catalog-chip" title="Complexity ${e.complexity}/5">${complexityDots(e.complexity)}</span>
    ${e.bookPage !== undefined ? `<span class="catalog-chip catalog-chip-ref">Scarne p. ${e.bookPage}</span>` : ""}
  `;
}

export class CatalogUI {
  private query = "";

  constructor(private slug: string | null) {
    this.render();
  }

  destroy(): void {
    document.getElementById("app")!.innerHTML = "";
  }

  private render(): void {
    const app = document.getElementById("app")!;
    const entry = this.slug ? getEntry(this.slug) : undefined;
    app.innerHTML = entry ? this.detailHtml(entry) : this.browseHtml();
    this.bindEvents(entry !== undefined);
  }

  private browseHtml(): string {
    const groups = groupedEntries(searchEntries(this.query));
    return `
      <div class="catalog">
        <div class="header">
          <div class="header-left">
            <a href="#" class="back-link">← Games</a>
            <h1>Rules Library</h1>
          </div>
        </div>
        <input type="search" id="catalog-search" class="catalog-search"
               placeholder="Search games..." value="${this.query.replace(/"/g, "&quot;")}" />
        ${
          groups.length === 0
            ? `<p class="catalog-empty">No games match.</p>`
            : groups
                .map(
                  (g) => `
          <div class="catalog-group">
            <h2 class="catalog-group-title">${g.label}</h2>
            <div class="catalog-list">
              ${g.entries
                .map(
                  (e) => `
                <a class="catalog-item" href="#/rules/${e.slug}">
                  <span class="catalog-item-name">${e.name}</span>
                  <span class="catalog-item-meta">${e.players} · ${complexityDots(e.complexity)}</span>
                  ${e.playableId ? `<span class="catalog-badge">Playable</span>` : ""}
                </a>`,
                )
                .join("")}
            </div>
          </div>`,
                )
                .join("")
        }
      </div>
    `;
  }

  private detailHtml(e: CatalogEntry): string {
    const playHref = e.playableId
      ? `#/${e.playableId}${e.presetId ? `?preset=${e.presetId}` : ""}`
      : null;
    return `
      <div class="catalog">
        <div class="header">
          <div class="header-left">
            <a href="#/rules" class="back-link">← Library</a>
            <h1>${e.name}</h1>
          </div>
        </div>
        ${e.aka?.length ? `<p class="catalog-aka">Also known as ${e.aka.join(", ")}</p>` : ""}
        <div class="catalog-chips">${metaChips(e)}</div>
        <div class="catalog-rules">${e.rulesHtml}</div>
        ${playHref ? `<a class="catalog-play-btn" href="${playHref}">Play ${e.name}</a>` : ""}
      </div>
    `;
  }

  private bindEvents(isDetail: boolean): void {
    if (isDetail) return;
    const input = document.getElementById(
      "catalog-search",
    ) as HTMLInputElement | null;
    input?.addEventListener("input", () => {
      this.query = input.value;
      const pos = input.selectionStart;
      this.render();
      const next = document.getElementById(
        "catalog-search",
      ) as HTMLInputElement | null;
      if (next) {
        next.focus();
        if (pos !== null) next.setSelectionRange(pos, pos);
      }
    });
  }
}
