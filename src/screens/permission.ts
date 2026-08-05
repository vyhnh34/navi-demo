import { session } from "../lib/state";
import { requestGeolocationOnce, requestOrientationPermission } from "../lib/geo";

/**
 * Permission gate, role-aware: the Finder needs Geolocation + (on iOS) motion/compass;
 * the Hider only needs Geolocation, so their position can be shared too. Both must be
 * requested from a real tap per PRD section 5/10 — this screen exists specifically to be
 * that tap, never auto-requested on load.
 */
export function renderPermission(app: HTMLElement, onGranted: (opts: { hasCompass: boolean }) => void): void {
  const isFinder = session.role === "finder";

  app.innerHTML = `
    <div class="screen">
      <img class="logo" src="/brand/logo.svg" alt="navi" />
      <p class="title">${isFinder ? "Let's find " + escapeHtml(session.partnerName) : "Share your location"}</p>
      <p class="subtitle">
        ${
          isFinder
            ? `Navi needs your location and compass to point you toward ${escapeHtml(session.partnerName)}.`
            : `Navi needs your location so ${escapeHtml(session.partnerName)} can find you.`
        }
      </p>
      <button id="enable" class="pill-button">${isFinder ? "Enable location & compass" : "Enable location"}</button>
      <p id="error" class="error-text" style="display:none"></p>
      <button id="skip-compass" class="pill-button pill-button--secondary" style="display:none;">Continue without compass</button>
    </div>
  `;

  const enableBtn = app.querySelector<HTMLButtonElement>("#enable")!;
  const errorEl = app.querySelector<HTMLParagraphElement>("#error")!;
  const skipBtn = app.querySelector<HTMLButtonElement>("#skip-compass")!;

  enableBtn.onclick = async () => {
    enableBtn.disabled = true;
    enableBtn.textContent = "Requesting…";
    errorEl.style.display = "none";
    skipBtn.style.display = "none";

    try {
      await requestGeolocationOnce();
    } catch (err) {
      errorEl.textContent = geoErrorMessage(err);
      errorEl.style.display = "block";
      enableBtn.disabled = false;
      enableBtn.textContent = isFinder ? "Enable location & compass" : "Enable location";
      return;
    }

    if (!isFinder) {
      onGranted({ hasCompass: false });
      return;
    }

    const hasCompass = await requestOrientationPermission();
    if (!hasCompass) {
      errorEl.textContent =
        "Compass access was denied. You can still navigate by distance alone, or enable Motion & Orientation Access in Settings and try again.";
      errorEl.style.display = "block";
      enableBtn.disabled = false;
      enableBtn.textContent = "Try again";
      skipBtn.style.display = "block";
      skipBtn.onclick = () => onGranted({ hasCompass: false });
      return;
    }

    onGranted({ hasCompass: true });
  };
}

function geoErrorMessage(err: unknown): string {
  if (err instanceof GeolocationPositionError) {
    if (err.code === err.PERMISSION_DENIED) {
      return "Location access was denied. Enable it for this site in your browser settings, then try again.";
    }
    if (err.code === err.TIMEOUT) {
      return "Location request timed out. Make sure location services are on, then try again.";
    }
    return "Couldn't get your location. Try again.";
  }
  if (err instanceof Error) return err.message;
  return "Couldn't get your location. Try again.";
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
