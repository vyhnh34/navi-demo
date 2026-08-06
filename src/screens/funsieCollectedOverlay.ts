import { session } from "../lib/state";
import { GRID_COLUMNS } from "../lib/funsiePattern";
import type { FunsieDrop } from "../types";

/**
 * Transient "funsie collected" moment, ported from the native app's `FunsieCollectedView`
 * (NaviPhone/Flow/FunsieCollectedView.swift): black full-bleed background, the funsie's own
 * pixel shape fading in (GlyphMorph's empty-to-pattern tween, here just a uniform alpha
 * fade-in since there's no "from" shape), "Collected" in the funsie's color. Same 350ms
 * ease-in-out reveal and ~3s hold as `PhoneSessionViewModel.collectFunsieIfNavigating`, then
 * reverts to Navigate underneath (which keeps running the whole time, matching the native
 * `.navigating, .funsieCollected` timers-stay-alive behavior).
 *
 * Unlike the native app's rarity-glyph funsies, these are the actual dropped shape — auto or
 * hand-drawn — so the copy calls out which kind this one was.
 */
const REVEAL_MS = 350;
const HOLD_MS = 3000;
const CANVAS_CSS_SIZE = 160;

export function showFunsieCollectedOverlay(app: HTMLElement, drop: FunsieDrop, onDone: () => void): void {
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:absolute; inset:0; z-index:20; background:#000; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;";
  overlay.innerHTML = `
    <canvas id="collected-canvas"></canvas>
    <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
      <p id="collected-title" style="font-size:20px; font-weight:700; margin:0;">Collected</p>
      <p id="collected-subtitle" style="font-size:14px; color: var(--navi-secondary); margin:0; max-width:260px;"></p>
    </div>
  `;
  app.appendChild(overlay);

  const canvas = overlay.querySelector<HTMLCanvasElement>("#collected-canvas")!;
  const ctx = canvas.getContext("2d")!;
  const title = overlay.querySelector<HTMLParagraphElement>("#collected-title")!;
  const subtitle = overlay.querySelector<HTMLParagraphElement>("#collected-subtitle")!;

  title.style.color = drop.color;
  subtitle.textContent =
    drop.source === "drawn"
      ? `${session.partnerName || "Your friend"} drew this one for you along the way`
      : "A funsie appeared along the trail";

  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${CANVAS_CSS_SIZE}px`;
  canvas.style.height = `${CANVAS_CSS_SIZE}px`;
  canvas.width = CANVAS_CSS_SIZE * dpr;
  canvas.height = CANVAS_CSS_SIZE * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const box = boundingBox(drop.cells);

  let start: number | null = null;
  let raf = 0;
  const frame = (ts: number): void => {
    if (start === null) start = ts;
    const t = Math.min(1, (ts - start) / REVEAL_MS);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    render(ctx, drop, box, eased);
    if (t < 1) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  setTimeout(() => {
    cancelAnimationFrame(raf);
    overlay.remove();
    onDone();
  }, REVEAL_MS + HOLD_MS);
}

interface BoundingBox {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
}

function boundingBox(cells: number[]): BoundingBox {
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

function render(ctx: CanvasRenderingContext2D, drop: FunsieDrop, box: BoundingBox, alpha: number): void {
  const size = CANVAS_CSS_SIZE;
  ctx.clearRect(0, 0, size, size);
  const rows = box.maxRow - box.minRow + 1;
  const cols = box.maxCol - box.minCol + 1;
  const cell = size / Math.max(rows, cols);
  const offsetX = (size - cols * cell) / 2;
  const offsetY = (size - rows * cell) / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = drop.color;
  for (const idx of drop.cells) {
    const row = Math.floor(idx / GRID_COLUMNS) - box.minRow;
    const col = (idx % GRID_COLUMNS) - box.minCol;
    ctx.fillRect(offsetX + col * cell, offsetY + row * cell, cell, cell);
  }
  ctx.restore();
}
