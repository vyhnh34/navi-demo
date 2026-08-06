import { session } from "../lib/state";
import { startHiderPositionSharing } from "../lib/hiderPosition";
import type { FunsieTrail } from "../lib/funsieTrail";
import type { LatLonAccuracy } from "../lib/geo";
import { PixelDrawGrid } from "../rendering/pixelDrawGrid";

/**
 * Hider's new "walking to hide" screen (PRD section 4/5), between permission and the existing
 * hiderWait screen. Two ways a funsie lands on the trail while this screen is up: automatically
 * every ~8-12m of movement (handled entirely inside `FunsieTrail`, fed by raw position updates
 * here), or hand-drawn on demand via "Draw a funsie here", reusing the same `PixelDrawGrid` as
 * the reward funsie. Tapping "I'm hidden" ends this phase and hands off to hiderWait.ts, where
 * the Hider draws one more funsie — the reward, separate from anything dropped along the way.
 */
export interface HiderWalkingHandle {
  stop: () => void;
}

export function renderHiderWalking(app: HTMLElement, trail: FunsieTrail, onHidden: () => void): HiderWalkingHandle {
  session.channel?.send({ type: "phase", value: "walking" });

  app.innerHTML = `
    <div class="screen" id="walking-screen">
      <img class="logo" src="/brand/logo.svg" alt="navi" style="width:72px; margin-bottom:4px;" />
      <p class="title">Head to your hiding spot</p>
      <p class="subtitle">Navi drops a funsie trail as you walk. Draw one yourself any time, or just keep moving.</p>
      <p id="drop-count" style="font-size:14px; color: var(--navi-secondary); margin: 4px 0 8px;">0 funsies dropped</p>
      <button id="draw-here" class="pill-button pill-button--secondary">Draw a funsie here</button>
      <button id="hidden" class="pill-button">I'm hidden</button>
    </div>
  `;

  const dropCountEl = app.querySelector<HTMLParagraphElement>("#drop-count")!;
  const drawHereBtn = app.querySelector<HTMLButtonElement>("#draw-here")!;
  const hiddenBtn = app.querySelector<HTMLButtonElement>("#hidden")!;

  let dropCount = 0;
  let lastPos: LatLonAccuracy | null = null;

  trail.onDrop = () => {
    dropCount += 1;
    dropCountEl.textContent = `${dropCount} funsie${dropCount === 1 ? "" : "s"} dropped`;
  };

  const stopSharingPosition = startHiderPositionSharing((pos) => {
    lastPos = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
    trail.onPosition(lastPos);
  });

  drawHereBtn.onclick = () => {
    renderDrawOverlay(app, trail, () => lastPos);
  };

  hiddenBtn.onclick = () => {
    session.channel?.send({ type: "phase", value: "navigating" });
    stopSharingPosition();
    trail.onDrop = null;
    onHidden();
  };

  return {
    stop: () => {
      trail.onDrop = null;
      stopSharingPosition();
    },
  };
}

function renderDrawOverlay(app: HTMLElement, trail: FunsieTrail, getPos: () => LatLonAccuracy | null): void {
  const overlay = document.createElement("div");
  overlay.className = "screen screen--fill";
  overlay.style.cssText = "position:absolute; inset:0; z-index:10; justify-content:flex-start;";
  overlay.innerHTML = `
    <canvas id="drop-draw-canvas" style="position:absolute; inset:0; width:100%; height:100%; touch-action:none;"></canvas>
    <div style="position:relative; width:100%; display:flex; flex-direction:column; height:100%; pointer-events:none;">
      <div style="display:flex; align-items:center; justify-content:space-between; padding: max(16px, env(safe-area-inset-top)) 16px 0;">
        <button id="drop-cancel" aria-label="Cancel" style="pointer-events:auto; background:none; border:none; color:var(--navi-secondary); font-size:15px; padding:8px; cursor:pointer;">Cancel</button>
        <button id="drop-reset" aria-label="Clear drawing" style="pointer-events:auto; background:none; border:none; color:var(--navi-secondary); font-size:20px; padding:8px; cursor:pointer;">&#8634;</button>
      </div>
      <div style="display:flex; justify-content:center; padding-top:16px;">
        <span style="font-size:14px; font-weight:600; color:var(--navi-white); background:rgba(0,0,0,0.4); padding:6px 14px; border-radius:999px;">Draw funsies for ${escapeHtml(session.partnerName || "your friend")} to collect</span>
      </div>
      <div style="flex:1;"></div>
      <div style="display:flex; justify-content:flex-end; padding: 0 16px max(16px, env(safe-area-inset-bottom));">
        <button id="drop-send" aria-label="Drop funsie here" class="pill-button" style="pointer-events:auto; min-width:0;">Drop here</button>
      </div>
    </div>
  `;
  app.appendChild(overlay);

  const canvas = overlay.querySelector<HTMLCanvasElement>("#drop-draw-canvas")!;
  const cancelBtn = overlay.querySelector<HTMLButtonElement>("#drop-cancel")!;
  const resetBtn = overlay.querySelector<HTMLButtonElement>("#drop-reset")!;
  const sendBtn = overlay.querySelector<HTMLButtonElement>("#drop-send")!;

  const grid = new PixelDrawGrid(canvas);

  resetBtn.onclick = () => grid.clear();
  cancelBtn.onclick = () => close();

  sendBtn.onclick = () => {
    const pos = getPos();
    if (!grid.hasDrawing() || !pos) return;
    trail.dropDrawn(pos, grid.getCells(), grid.getColor());
    close();
  };

  function close() {
    grid.destroy();
    overlay.remove();
  }
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
