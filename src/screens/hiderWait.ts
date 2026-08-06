import { session } from "../lib/state";
import { startHiderPositionSharing } from "../lib/hiderPosition";
import { PixelDrawGrid } from "../rendering/pixelDrawGrid";

/**
 * Hider's "wait" screen: full-bleed pixel doodle canvas, ported from the watch's
 * DrawFunsieView.swift as faithfully as possible via the shared `PixelDrawGrid` — same
 * 14-column grid, same random single-color-per-drawing palette, same "sending clears the
 * canvas, screen doesn't change" behavior. Draws the reward funsie (handed over at Reunion,
 * separate from anything dropped along the trail) while waiting for the Finder.
 *
 * Also shares this device's location in the background (per PRD section 5/7 — the Hider
 * broadcasts `hider-position` on the same cadence as the Finder), so the Finder's Navigate
 * screen has something to point at once the trail is exhausted. The permission screen (see
 * permission.ts) already secured Geolocation access before this screen mounts.
 */

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
  const resetBtn = app.querySelector<HTMLButtonElement>("#reset")!;
  const sendBtn = app.querySelector<HTMLButtonElement>("#send")!;
  const toast = app.querySelector<HTMLDivElement>("#toast")!;

  const grid = new PixelDrawGrid(canvas);

  resetBtn.onclick = () => grid.clear();

  sendBtn.onclick = () => {
    if (!grid.hasDrawing()) return;
    session.channel?.send({
      type: "funsie-sent",
      cells: grid.getCells(),
      color: grid.getColor(),
    });
    grid.clear();
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

  const stopSharingPosition = startHiderPositionSharing();

  return {
    stop: () => {
      grid.destroy();
      stopSharingPosition();
    },
  };
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
