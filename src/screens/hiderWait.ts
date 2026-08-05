import { session } from "../lib/state";
import { watchPosition } from "../lib/geo";
import { createThrottle } from "../lib/throttle";
import type { HiderPositionEvent } from "../types";

/**
 * Hider's "wait" screen: full-bleed pixel doodle canvas, ported from the watch's
 * DrawFunsieView.swift as faithfully as possible — same 14-column grid, same random
 * single-color-per-drawing palette, same "sending clears the canvas, screen doesn't
 * change" behavior. Draws while waiting for the Finder to close the distance.
 *
 * Also shares this device's location in the background (per PRD section 5/7 — the Hider
 * broadcasts `hider-position` on the same cadence as the Finder), so the Finder's Navigate
 * screen has something to point at. The permission screen (see permission.ts) already
 * secured Geolocation access before this screen mounts.
 */

const POSITION_BROADCAST_INTERVAL_MS = 2500;

const COLUMNS = 14;

const PALETTE = [
  "#f06b6b", // coral
  "#ffb84d", // amber
  "#8cd98c", // mint
  "#66b3ff", // cyan
  "#ffffff", // white
];

export interface HiderWaitHandle {
  stop: () => void;
}

export function renderHiderWait(app: HTMLElement): HiderWaitHandle {
  app.innerHTML = `
    <div class="screen screen--fill" style="justify-content: flex-start;">
      <canvas id="draw-canvas" style="position:absolute; inset:0; width:100%; height:100%; touch-action:none;"></canvas>

      <div style="position:relative; width:100%; display:flex; flex-direction:column; height:100%; pointer-events:none;">
        <div style="display:flex; align-items:center; justify-content:space-between; padding: max(16px, env(safe-area-inset-top)) 16px 0;">
          <div style="display:flex; align-items:center; gap:8px; pointer-events:none;">
            <span class="avatar" style="width:28px;height:28px;font-size:12px;">${initials(session.partnerName)}</span>
            <span style="font-size:15px; color: var(--navi-secondary);">${escapeHtml(session.partnerName)} is finding you</span>
          </div>
          <button id="reset" aria-label="Clear drawing" style="pointer-events:auto; background:none; border:none; color:var(--navi-secondary); font-size:20px; padding:8px; cursor:pointer;">&#8634;</button>
        </div>

        <div style="flex:1;"></div>

        <div style="display:flex; justify-content:flex-end; padding: 0 16px max(16px, env(safe-area-inset-bottom));">
          <button id="send" aria-label="Send funsie" style="pointer-events:auto; width:52px; height:52px; border-radius:999px; background:rgba(255,255,255,0.18); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 11L21 3L13 21L11 13L3 11Z" fill="white"/></svg>
          </button>
        </div>
      </div>

      <div id="toast" style="position:absolute; top: max(64px, calc(env(safe-area-inset-top) + 48px)); left:50%; transform: translateX(-50%) translateY(-10px); background: rgba(57,202,138,0.95); color:#04140c; font-weight:600; font-size:14px; padding:8px 16px; border-radius:999px; opacity:0; transition: opacity 0.25s ease, transform 0.25s ease; pointer-events:none;">Sent</div>
    </div>
  `;

  const canvas = app.querySelector<HTMLCanvasElement>("#draw-canvas")!;
  const ctx = canvas.getContext("2d")!;
  const resetBtn = app.querySelector<HTMLButtonElement>("#reset")!;
  const sendBtn = app.querySelector<HTMLButtonElement>("#send")!;
  const toast = app.querySelector<HTMLDivElement>("#toast")!;

  let cells = new Set<number>();
  let currentColor = randomColor();
  let cellSize = 0;
  let rowCount = 0;
  let lastPoint: { x: number; y: number } | null = null;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cellSize = rect.width / COLUMNS;
    rowCount = Math.max(4, Math.ceil(rect.height / cellSize));
    draw();
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = currentColor;
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    for (const index of cells) {
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const x = col * cellSize;
      const y = row * cellSize;
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.strokeRect(x, y, cellSize, cellSize);
    }
  }

  function paintAt(x: number, y: number) {
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (col < 0 || col >= COLUMNS || row < 0 || row >= rowCount) return;
    cells.add(row * COLUMNS + col);
  }

  function paintStroke(x: number, y: number) {
    const start = lastPoint ?? { x, y };
    const steps = Math.max(1, Math.floor(Math.max(Math.abs(x - start.x), Math.abs(y - start.y)) / (cellSize / 2)));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      paintAt(start.x + (x - start.x) * t, start.y + (y - start.y) * t);
    }
    lastPoint = { x, y };
    draw();
  }

  function pointerPos(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  let painting = false;
  canvas.onpointerdown = (e) => {
    painting = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pointerPos(e);
    lastPoint = null;
    paintStroke(x, y);
  };
  canvas.onpointermove = (e) => {
    if (!painting) return;
    const { x, y } = pointerPos(e);
    paintStroke(x, y);
  };
  canvas.onpointerup = () => {
    painting = false;
    lastPoint = null;
  };
  canvas.onpointercancel = () => {
    painting = false;
    lastPoint = null;
  };

  resetBtn.onclick = () => {
    cells = new Set();
    draw();
  };

  sendBtn.onclick = () => {
    if (cells.size === 0) return;
    session.channel?.send({
      type: "funsie-sent",
      cells: Array.from(cells),
      color: currentColor,
    });
    cells = new Set();
    currentColor = randomColor();
    draw();
    showToast();
  };

  function showToast() {
    toast.style.opacity = "1";
    toast.style.transform = "translateX(-50%) translateY(0)";
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(-10px)";
    }, 1200);
  }

  window.addEventListener("resize", resize);
  resize();

  const positionReady = createThrottle(POSITION_BROADCAST_INTERVAL_MS);
  const stopWatchingPosition = watchPosition(
    (pos) => {
      if (!positionReady()) return;
      const event: HiderPositionEvent = {
        type: "hider-position",
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        updatedAt: Date.now(),
      };
      session.channel?.send(event);
    },
    () => {
      // Silently retry on the next watchPosition tick — the Hider's screen has no
      // status line to surface this on, and permission.ts already handled the "denied"
      // case before this screen could ever mount.
    }
  );

  return {
    stop: () => {
      window.removeEventListener("resize", resize);
      stopWatchingPosition();
    },
  };
}

function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)]!;
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
