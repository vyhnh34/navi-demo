/**
 * Canvas 2D port of `NaviShared/Rendering/DirectionalPixelField.swift`. Same algorithm:
 * a grid of cells whose on/off state is driven by alignment with a target bearing, a
 * per-cell stable-noise dither for the falloff scatter, and a slow sinusoidal wobble so
 * the cluster's edge breathes instead of holding still. `angleDegrees` is expected to be
 * externally animated (eased) by the caller on sector changes, exactly like the Swift
 * view's `animatableData`.
 */
export interface PixelFieldOptions {
  columns?: number;
  coreThreshold?: number;
  falloffGamma?: number;
  wobbleAmount?: number;
}

export class DirectionalPixelField {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private angleDegrees = 0;
  private color = "#ffffff";
  /** When set, one on-cell near the target direction is tinted this color instead of
   * `color` — the funsie the Finder is currently heading toward, same as the native app's
   * `guideColor` (there driven by `nextFunsieRarity.color`). */
  private guideColor: string | null = null;
  private rafId: number | null = null;
  private startTime = performance.now();

  private columns: number;
  private coreThreshold: number;
  private falloffGamma: number;
  private wobbleAmount: number;

  private readonly baseCoreThreshold: number;
  private readonly baseFalloffGamma: number;

  constructor(canvas: HTMLCanvasElement, opts: PixelFieldOptions = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.columns = opts.columns ?? 14;
    this.coreThreshold = opts.coreThreshold ?? 0.76;
    this.falloffGamma = opts.falloffGamma ?? 2.6;
    this.wobbleAmount = opts.wobbleAmount ?? 0.15;
    this.baseCoreThreshold = this.coreThreshold;
    this.baseFalloffGamma = this.falloffGamma;
  }

  setAngle(deg: number): void {
    this.angleDegrees = deg;
  }

  setColor(cssColor: string): void {
    this.color = cssColor;
  }

  setGuideColor(cssColor: string | null): void {
    this.guideColor = cssColor;
  }

  /** Low-confidence GPS reading: widen and soften the cluster rather than showing a
   * falsely precise shape, per PRD section 5. */
  setLowConfidence(low: boolean): void {
    this.coreThreshold = low ? Math.min(0.92, this.baseCoreThreshold + 0.14) : this.baseCoreThreshold;
    this.falloffGamma = low ? Math.max(1.2, this.baseFalloffGamma - 1.2) : this.baseFalloffGamma;
    this.canvas.style.opacity = low ? "0.7" : "1";
  }

  start(): void {
    if (this.rafId != null) return;
    const loop = () => {
      this.draw();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private draw(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const pixelWidth = Math.round(rect.width * dpr);
    const pixelHeight = Math.round(rect.height * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const columns = this.columns;
    const cellSize = rect.width / columns;
    const rows = Math.ceil(rect.height / cellSize) + 1;
    if (rows <= 0 || !isFinite(cellSize) || cellSize <= 0) return;

    const time = (performance.now() - this.startTime) / 1000;
    const radians = (this.angleDegrees * Math.PI) / 180;
    // Bearing 0 = north = toward the top of the screen.
    const dx = Math.sin(radians);
    const dy = -Math.cos(radians);

    const centerX = (columns - 1) / 2;
    const centerY = (rows - 1) / 2;
    const norm = Math.max(centerX, centerY);

    // Fixed anchor a bit shy of the outer edge of the mass, along the target bearing — used
    // to pick which "on" cell becomes the guide pixel, so it sits inside the cluster rather
    // than jumping to whichever cell happens to be on this frame.
    const anchorX = centerX + dx * norm * 0.55;
    const anchorY = centerY + dy * norm * 0.55;
    let guideCol = -1;
    let guideRow = -1;
    let guideDistance = Infinity;

    ctx.fillStyle = this.color;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const nx = (col - centerX) / norm;
        const ny = (row - centerY) / norm;

        const alignment = nx * dx + ny * dy;
        const wobble = Math.sin(nx * 2.6 + time * 0.9) * Math.cos(ny * 2.4 - time * 0.7) * this.wobbleAmount;
        const t = Math.min(Math.max((alignment + 1) / 2 + wobble, 0), 1);

        const isOn = t >= this.coreThreshold ? true : Math.pow(t, this.falloffGamma) > stableNoise(col, row);
        if (!isOn) continue;

        if (this.guideColor) {
          const distance = Math.hypot(col - anchorX, row - anchorY);
          if (distance < guideDistance) {
            guideDistance = distance;
            guideCol = col;
            guideRow = row;
          }
        }

        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }

    if (this.guideColor && guideCol >= 0) {
      ctx.fillStyle = this.guideColor;
      ctx.fillRect(guideCol * cellSize, guideRow * cellSize, cellSize, cellSize);
    }
  }
}

/** Deterministic per-cell dither threshold — same shape as the Swift hash (not
 * bit-identical, since JS has no native 64-bit wrapping arithmetic), stable across frames
 * so the wobble reads as one moving cluster rather than random static. */
function stableNoise(col: number, row: number): number {
  let x = (row * 374761393 + col * 668265263) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x = x ^ (x >>> 16);
  return ((x >>> 0) % 10000) / 10000;
}
