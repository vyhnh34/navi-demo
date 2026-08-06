import { session } from "../lib/state";
import { funsieGlyphBoundingBox, drawFunsieGlyph } from "../rendering/funsieGlyph";

const TILE_CSS_SIZE = 64;

/** Grid view of every trail funsie collected this session (auto or drawn), reached from a
 * button on the Reward screen. Local-only navigation — not phase-synced, since it's just a
 * personal look back, not something both clients need to see at the same moment. */
export function renderFunsiesCollection(app: HTMLElement, onBack: () => void): void {
  const funsies = session.collectedFunsies;

  app.innerHTML = `
    <div class="screen">
      <p class="title">Funsies collected</p>
      <p class="subtitle">${funsies.length} funsie${funsies.length === 1 ? "" : "s"} found along the way</p>
      <div id="funsies-grid" style="display:grid; grid-template-columns: repeat(auto-fill, ${TILE_CSS_SIZE}px); gap:12px; justify-content:center; max-width:340px; max-height:50vh; overflow-y:auto; padding:4px;"></div>
      <button id="back" class="pill-button pill-button--secondary">Back</button>
    </div>
  `;

  const grid = app.querySelector<HTMLDivElement>("#funsies-grid")!;

  if (funsies.length === 0) {
    grid.style.display = "none";
  } else {
    const dpr = window.devicePixelRatio || 1;
    for (const funsie of funsies) {
      const canvas = document.createElement("canvas");
      canvas.style.width = `${TILE_CSS_SIZE}px`;
      canvas.style.height = `${TILE_CSS_SIZE}px`;
      canvas.width = TILE_CSS_SIZE * dpr;
      canvas.height = TILE_CSS_SIZE * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const box = funsieGlyphBoundingBox(funsie.cells);
      drawFunsieGlyph(ctx, funsie.cells, funsie.color, box, 1, TILE_CSS_SIZE);
      grid.appendChild(canvas);
    }
  }

  app.querySelector<HTMLButtonElement>("#back")!.onclick = onBack;
}
