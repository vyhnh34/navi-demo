import { session } from "../lib/state";

/**
 * Ported from the native app's `ReunionView` (NaviPhone/Flow/ReunionView.swift): a light
 * background — deliberately breaking from the rest of the app's dark screens, same as the
 * native comment calls out — with two overlapping circles that spring-scale in, then
 * "Reunited!". The native version uses real profile photos; this build has none, so initials
 * avatars stand in, same substitution hiderWait.ts already makes for the partner avatar.
 * No buttons — auto-advances to Reward after a beat, matching the native's buttonless timing.
 */
const REWARD_DELAY_MS = 1800;

export interface ReunitedHandle {
  stop: () => void;
}

export function renderReunited(app: HTMLElement): ReunitedHandle {
  app.innerHTML = `
    <div class="screen" style="background: #f4f4ef;">
      <div style="position:relative; width:160px; height:120px;">
        <div id="avatar-you" style="position:absolute; left:22px; top:6px; width:96px; height:96px; border-radius:999px; background: var(--friend-mint); border:4px solid #f4f4ef; display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:700; color:#04140c; transform: scale(0.6); transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">${initials(session.name)}</div>
        <div id="avatar-friend" style="position:absolute; left:58px; top:24px; width:96px; height:96px; border-radius:999px; background: var(--friend-cyan); border:4px solid #f4f4ef; display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:700; color:#04140c; transform: scale(0.6); transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);">${initials(session.partnerName)}</div>
      </div>
      <p class="title" style="color:#111; margin-top:24px;">Reunited!</p>
    </div>
  `;

  const you = app.querySelector<HTMLDivElement>("#avatar-you")!;
  const friend = app.querySelector<HTMLDivElement>("#avatar-friend")!;
  requestAnimationFrame(() => {
    you.style.transform = "scale(1)";
    friend.style.transform = "scale(1)";
  });

  const timer = setTimeout(() => {
    session.channel?.send({ type: "phase", value: "reward" });
  }, REWARD_DELAY_MS);

  return {
    stop: () => clearTimeout(timer),
  };
}

function initials(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}
