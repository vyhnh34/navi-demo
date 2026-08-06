/** Flat-index stride shared by every funsie cell grid in this app — hand-drawn (14 columns,
 * variable rows) and procedurally generated (9x9, embedded at the same stride) alike, so a
 * `cells: number[]` array is self-describing without needing to carry its own column count. */
export const GRID_COLUMNS = 14;

const AUTO_FUNSIE_GRID_SIZE = 9;

/** Ported from the native app's `FunsiePatterns.pattern(seed:)` (NaviShared/Rendering/
 * GlyphPatterns.swift): a deterministic, mirrored, center-weighted blob so the result reads as
 * a little creature rather than noise. Exact bit-for-bit output isn't required to match the
 * Swift version (different integer width), just the same generator shape and feel. */
export function generateAutoFunsieCells(seed: number): number[] {
  const size = AUTO_FUNSIE_GRID_SIZE;
  const half = Math.ceil(size / 2);
  const center = (size - 1) / 2;
  const grid: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < half; col++) {
      const dx = (col - center) / center;
      const dy = (row - center) / center;
      const radial = Math.min(Math.sqrt(dx * dx + dy * dy), 1);
      const probability = 0.92 - Math.pow(radial, 1.5) * 0.85;
      const on = noise(row, col, seed) < probability;
      grid[row]![col] = on;
      grid[row]![size - 1 - col] = on; // mirror for symmetry
    }
  }

  const cells: number[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (grid[row]![col]) cells.push(row * GRID_COLUMNS + col);
    }
  }
  return cells;
}

export function randomFunsieSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

/** 32-bit-wrapping hash, same shape as the Swift source's `noise(row:col:seed:)`. */
function noise(row: number, col: number, seed: number): number {
  let x = (Math.imul(row, 374761393) + Math.imul(col, 668265263) + Math.imul(seed, 2654435761)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return ((x >>> 0) % 10000) / 10000;
}
