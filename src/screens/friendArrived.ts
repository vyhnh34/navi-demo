import { session } from "../lib/state";
import { friendColorForName } from "../lib/friendColor";

/**
 * Ported from the watch app's `FriendArrivedView` (Navi Watch App/Views/FriendArrivedView.swift):
 * eye icon, "{name} is near", "Look around". The native version is buttonless (paired with a
 * haptic, never expects a tap); this build adds an explicit "We've reunited" button on top of
 * that, since GPS proximity alone can be slow or unreliable to confirm indoors — the auto-
 * advance timer still fires as a fallback so the screen doesn't stall if nobody taps.
 */
const AUTO_ADVANCE_MS = 2200;

export interface FriendArrivedHandle {
  stop: () => void;
}

export function renderFriendArrived(app: HTMLElement): FriendArrivedHandle {
  const color = friendColorForName(session.partnerName);

  app.innerHTML = `
    <div class="screen">
      <div class="pulse-icon">${eyeIcon(color)}</div>
      <p class="title">${escapeHtml(session.partnerName || "Your friend")} is near</p>
      <p class="subtitle">Look around</p>
      <button id="reunited" class="pill-button" style="margin-top:16px;">We've reunited</button>
    </div>
  `;

  if (navigator.vibrate) navigator.vibrate(80);

  const timer = setTimeout(() => {
    session.channel?.send({ type: "phase", value: "reunited" });
  }, AUTO_ADVANCE_MS);

  app.querySelector<HTMLButtonElement>("#reunited")!.onclick = () => {
    clearTimeout(timer);
    session.channel?.send({ type: "phase", value: "reunited" });
  };

  return {
    stop: () => clearTimeout(timer),
  };
}

function eyeIcon(color: string): string {
  return `
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 12C1 12 5 5 12 5C19 5 23 12 23 12C23 12 19 19 12 19C5 19 1 12 1 12Z" fill="${color}"/>
      <circle cx="12" cy="12" r="4" fill="#04140c"/>
      <circle cx="12" cy="12" r="1.6" fill="${color}"/>
    </svg>
  `;
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
