import { session } from "./state";
import { watchPosition } from "./geo";
import { createThrottle } from "./throttle";
import type { HiderPositionEvent } from "../types";

const POSITION_BROADCAST_INTERVAL_MS = 2500;

/** Shared by every Hider-side screen (walking, wait) so `hider-position` keeps flowing to the
 * Finder without a gap across the phase transition. `onUpdate` fires on every raw GPS callback
 * (not just the throttled broadcast tick) for callers that need finer-grained position, e.g.
 * the walking screen's distance-based breadcrumb trigger. */
export function startHiderPositionSharing(onUpdate?: (pos: GeolocationPosition) => void): () => void {
  const positionReady = createThrottle(POSITION_BROADCAST_INTERVAL_MS);
  return watchPosition(
    (pos) => {
      onUpdate?.(pos);
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
      // Silently retry on the next watchPosition tick — permission.ts already handled
      // the "denied" case before any Hider screen could mount.
    }
  );
}
