import { GRID_COLUMNS } from "../lib/funsiePattern";
import { randomFunsieColor } from "../lib/funsiePalette";

/**
 * The pixel doodle grid, ported from the watch's `DrawFunsieView.swift`: a 14-column grid,
 * stroke interpolation between pointer samples, one random color per drawing. Shared by both
 * the reward-funsie draw screen (hiderWait.ts) and the "Draw a funsie here" trail-drop overlay
 * (hiderWalking.ts) — the PRD calls for "the same pixel drawing grid already built for the
 * reward funsie," not a second implementation.
 */
export class PixelDrawGrid {
  private ctx: CanvasRenderingContext2D;
  private cells = new Set<number>();
  private currentColor = randomFunsieColor();
  private cellSize = 0;
  private rowCount = 0;
  private lastPoint: { x: number; y: number } | null = null;
  private painting = false;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    canvas.onpointerdown = (e) => {
      this.painting = true;
      canvas.setPointerCapture(e.pointerId);
      this.lastPoint = null;
      this.paintStroke(...this.pointerPos(e));
    };
    canvas.onpointermove = (e) => {
      if (!this.painting) return;
      this.paintStroke(...this.pointerPos(e));
    };
    canvas.onpointerup = () => {
      this.painting = false;
      this.lastPoint = null;
    };
    canvas.onpointercancel = () => {
      this.painting = false;
      this.lastPoint = null;
    };

    window.addEventListener("resize", this.resize);
    this.resize();
  }

  hasDrawing(): boolean {
    return this.cells.size > 0;
  }

  getCells(): number[] {
    return Array.from(this.cells);
  }

  getColor(): string {
    return this.currentColor;
  }

  clear(): void {
    this.cells = new Set();
    this.currentColor = randomFunsieColor();
    this.draw();
  }

  destroy(): void {
    window.removeEventListener("resize", this.resize);
    this.canvas.onpointerdown = null;
    this.canvas.onpointermove = null;
    this.canvas.onpointerup = null;
    this.canvas.onpointercancel = null;
  }

  private resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cellSize = rect.width / GRID_COLUMNS;
    this.rowCount = Math.max(4, Math.ceil(rect.height / this.cellSize));
    this.draw();
  };

  private draw(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, rect.width, rect.height);
    this.ctx.fillStyle = this.currentColor;
    this.ctx.strokeStyle = "rgba(0,0,0,0.3)";
    this.ctx.lineWidth = 1;
    for (const index of this.cells) {
      const col = index % GRID_COLUMNS;
      const row = Math.floor(index / GRID_COLUMNS);
      const x = col * this.cellSize;
      const y = row * this.cellSize;
      this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
      this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
    }
  }

  private paintAt(x: number, y: number): void {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || col >= GRID_COLUMNS || row < 0 || row >= this.rowCount) return;
    this.cells.add(row * GRID_COLUMNS + col);
  }

  private paintStroke(x: number, y: number): void {
    const start = this.lastPoint ?? { x, y };
    const steps = Math.max(1, Math.floor(Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) / (this.cellSize / 2)));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      this.paintAt(start.x + (x - start.x) * t, start.y + (y - start.y) * t);
    }
    this.lastPoint = { x, y };
    this.draw();
  }

  private pointerPos(e: PointerEvent): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }
}
