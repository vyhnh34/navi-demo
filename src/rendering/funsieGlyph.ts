import { GRID_COLUMNS } from "../lib/funsiePattern";

/**
 * Shared bounding-box-crop-and-fade renderer for a funsie's `cells`, used by any screen that
 * needs the `GlyphMorph`-style empty-to-pattern reveal (funsieCollectedOverlay.ts, reward.ts)
 * without redrawing the same crop/fill logic in each.
 */
export interface FunsieGlyphBox {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

export function funsieGlyphBoundingBox(cells: number[]): FunsieGlyphBox {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;
  for (const idx of cells) {
    const row = Math.floor(idx / GRID_COLUMNS);
    const col = idx % GRID_COLUMNS;
    minRow = Math.min(minRow, row);
    maxRow = Math.max(maxRow, row);
    minCol = Math.min(minCol, col);
    maxCol = Math.max(maxCol, col);
  }
  if (!Number.isFinite(minRow)) return { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 };
  return { minRow, maxRow, minCol, maxCol };
}

/** Draws `cells` cropped to `box` and centered in a `size`x`size` square, at uniform `alpha` —
 * the same "from empty" tween the native `GlyphMorph` produces when every on-cell fades in
 * together rather than a cell-by-cell morph between two distinct shapes. */
export function drawFunsieGlyph(
  ctx: CanvasRenderingContext2D,
  cells: number[],
  color: string,
  box: FunsieGlyphBox,
  alpha: number,
  size: number
): void {
  ctx.clearRect(0, 0, size, size);
  const rows = box.maxRow - box.minRow + 1;
  const cols = box.maxCol - box.minCol + 1;
  const cell = size / Math.max(rows, cols);
  const offsetX = (size - cols * cell) / 2;
  const offsetY = (size - rows * cell) / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  for (const idx of cells) {
    const row = Math.floor(idx / GRID_COLUMNS) - box.minRow;
    const col = (idx % GRID_COLUMNS) - box.minCol;
    ctx.fillRect(offsetX + col * cell, offsetY + row * cell, cell, cell);
  }
  ctx.restore();
}

/** Standard ease-in-out quad, matching the Swift source's `.easeInOut` reveal curve. */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
