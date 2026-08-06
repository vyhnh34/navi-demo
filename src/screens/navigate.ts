import { session } from "../lib/state";
import { bearingDegrees, haversineMeters, watchHeading, watchPosition, type LatLonAccuracy } from "../lib/geo";
import { createThrottle } from "../lib/throttle";
import { friendColorForName } from "../lib/friendColor";
import { DirectionalPixelField } from "../rendering/directionalPixelField";
import { AngleAnimator } from "../rendering/angleAnimator";
import { sectorCenterDegrees, snapSector, type Sector } from "../lib/compassSector";
import { showFunsieCollectedOverlay } from "./funsieCollectedOverlay";
import type { PositionEvent, HiderPositionEvent, FunsieDrop, FunsieDroppedEvent, SyncEvent } from "../types";

const CONFIDENCE_ACCURACY_THRESHOLD_M = 25;
const POSITION_BROADCAST_INTERVAL_MS = 2500;
// Real on-site GPS testing measured ~±3m indoors — tightened from the original wider estimate.
// Worth another on-site tuning pass rather than treating this as final.
const PROXIMITY_COLLECT_METERS = 4;

export interface NavigateHandle {
  stop: () => void;
}

export function renderNavigate(app: HTMLElement, opts: { hasCompass: boolean }): NavigateHandle {
  app.innerHTML = `
    <div class="screen screen--fill">
      <canvas id="pixel-field" style="position:absolute; inset:0; width:100%; height:100%;"></canvas>

      <img
        src="/brand/compass-arrow.svg"
        alt=""
        style="position:absolute; top:50%; left:50%; width:168px; height:189px; transform: translate(-50%, -50%) translateY(-72px); filter: drop-shadow(0 2px 3px rgba(0,0,0,0.6));"
      />

      <div style="position:absolute; left:0; right:0; bottom:max(28px, env(safe-area-inset-bottom)); display:flex; flex-direction:column; align-items:center; gap:2px;">
        <div id="distance-line" style="font-size:16px; color:white;">Searching…</div>
        <div id="sector-line" style="font-size:24px; font-weight:700; color:white;"></div>
      </div>

      <div style="position:absolute; top:max(16px, env(safe-area-inset-top)); left:0; right:0; display:flex; justify-content:center;">
        <div id="confidence-badge" style="display:none; background:rgba(0,0,0,0.5); color:rgba(255,255,255,0.85); font-size:12px; padding:4px 10px; border-radius:999px;">Low signal — getting warmer</div>
      </div>
    </div>
  `;

  const canvas = app.querySelector<HTMLCanvasElement>("#pixel-field")!;
  const distanceLine = app.querySelector<HTMLDivElement>("#distance-line")!;
  const sectorLine = app.querySelector<HTMLDivElement>("#sector-line")!;
  const confidenceBadge = app.querySelector<HTMLDivElement>("#confidence-badge")!;

  const field = new DirectionalPixelField(canvas);
  field.setColor(friendColorForName(session.partnerName));
  field.start();

  let currentSector: Sector | null = null;
  const angleAnimator = new AngleAnimator((angle) => field.setAngle(angle), 0);

  let finderPos: LatLonAccuracy | null = null;
  let hiderPos: LatLonAccuracy | null = null;
  let heading = 0;
  let lastDistance: number | null = null;
  let lastTargetKey: string | null = null;
  let overlayActive = false;

  // Not-yet-collected funsies dropped along the Hider's walk (PRD section 5) — the Finder's
  // navigation target is the nearest of these, recomputed on every position/drop update,
  // falling back to the Hider's live position once the trail is exhausted.
  const uncollected = new Map<string, FunsieDrop>();

  function nearestUncollectedDrop(from: LatLonAccuracy): FunsieDrop | null {
    let best: FunsieDrop | null = null;
    let bestDist = Infinity;
    for (const drop of uncollected.values()) {
      const dist = haversineMeters(from, { lat: drop.lat, lon: drop.lon, accuracy: 0 });
      if (dist < bestDist) {
        bestDist = dist;
        best = drop;
      }
    }
    return best;
  }

  function recompute(): void {
    if (!finderPos || overlayActive) return;

    const targetDrop = nearestUncollectedDrop(finderPos);
    const target: LatLonAccuracy | null = targetDrop
      ? { lat: targetDrop.lat, lon: targetDrop.lon, accuracy: 0 }
      : hiderPos;
    if (!target) return;

    // A cell inside the cluster tinted to the funsie the Finder is currently heading
    // toward — ported from the native app's `guideColor` (there driven by the upcoming
    // funsie's rarity color; here it's the actual target funsie's own color).
    field.setGuideColor(targetDrop ? targetDrop.color : null);

    const targetKey = targetDrop ? targetDrop.id : "hider";
    if (targetKey !== lastTargetKey) {
      lastTargetKey = targetKey;
      lastDistance = null;
    }

    const distance = haversineMeters(finderPos, target);
    const bearing = bearingDegrees(finderPos, target);
    const relativeAngle = ((bearing - heading) % 360 + 360) % 360;

    const newSector = snapSector(relativeAngle, currentSector);
    if (newSector !== currentSector) {
      currentSector = newSector;
      angleAnimator.animateTo(sectorCenterDegrees(newSector));
    }

    if (targetDrop && distance <= PROXIMITY_COLLECT_METERS) {
      overlayActive = true;
      uncollected.delete(targetDrop.id);
      session.channel?.send({ type: "funsie-collected", id: targetDrop.id });
      showFunsieCollectedOverlay(app, targetDrop, () => {
        overlayActive = false;
        recompute();
      });
      return;
    }

    const otherAccuracy = targetDrop ? 0 : (hiderPos?.accuracy ?? 0);
    const lowConfidence = finderPos.accuracy > CONFIDENCE_ACCURACY_THRESHOLD_M || otherAccuracy > CONFIDENCE_ACCURACY_THRESHOLD_M;
    field.setLowConfidence(lowConfidence);
    confidenceBadge.style.display = lowConfidence ? "block" : "none";

    if (lowConfidence) {
      if (lastDistance == null) {
        distanceLine.textContent = "Getting a signal…";
      } else if (distance < lastDistance - 1) {
        distanceLine.textContent = "Getting warmer";
      } else if (distance > lastDistance + 1) {
        distanceLine.textContent = "Getting colder";
      } else {
        distanceLine.textContent = "Hold on…";
      }
    } else {
      distanceLine.textContent = targetDrop ? `${Math.round(distance)}m to a funsie` : `${Math.round(distance)}m towards`;
    }
    sectorLine.textContent = currentSector ?? "";

    lastDistance = distance;
  }

  const unsubscribeHiderPosition = session.channel!.on("hider-position", (e: HiderPositionEvent) => {
    hiderPos = { lat: e.lat, lon: e.lon, accuracy: e.accuracy };
    recompute();
  });

  const unsubscribeFunsieDropped = session.channel!.on("funsie-dropped", (e: FunsieDroppedEvent) => {
    uncollected.set(e.id, { id: e.id, lat: e.lat, lon: e.lon, cells: e.cells, color: e.color, droppedAt: e.droppedAt, source: e.source });
    recompute();
  });

  const unsubscribeSync = session.channel!.on("sync", (e: SyncEvent) => {
    for (const drop of e.drops) uncollected.set(drop.id, drop);
    recompute();
  });

  session.channel?.send({ type: "request-sync" });

  const positionReady = createThrottle(POSITION_BROADCAST_INTERVAL_MS);
  const stopWatchingPosition = watchPosition(
    (pos) => {
      finderPos = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      recompute();
      if (positionReady()) {
        const event: PositionEvent = {
          type: "position",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          headingDeg: opts.hasCompass ? heading : null,
          updatedAt: Date.now(),
        };
        session.channel?.send(event);
      }
    },
    (err) => {
      distanceLine.textContent = `Location error: ${err.message}`;
    }
  );

  const stopWatchingHeading = opts.hasCompass
    ? watchHeading((deg) => {
        heading = deg;
        recompute();
      })
    : () => {};

  return {
    stop: () => {
      field.stop();
      angleAnimator.stop();
      unsubscribeHiderPosition();
      unsubscribeFunsieDropped();
      unsubscribeSync();
      stopWatchingPosition();
      stopWatchingHeading();
    },
  };
}
