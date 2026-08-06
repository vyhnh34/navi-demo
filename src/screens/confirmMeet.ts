import { session } from "../lib/state";

/**
 * PRD section 5's "confirm we met" screen: shown to both roles once the Finder is within the
 * proximity threshold of the Hider's live position (see navigate.ts's phase:"close" trigger).
 * Either side tapping the button advances both to Reunited — this screen only ever broadcasts
 * the transition, it never mounts the next screen itself; main.ts's phase listener is the one
 * path responsible for that, so a tap here and the network echo of someone else's tap behave
 * identically.
 */
export interface ConfirmMeetHandle {
  stop: () => void;
}

export function renderConfirmMeet(app: HTMLElement): ConfirmMeetHandle {
  app.innerHTML = `
    <div class="screen">
      <div class="pulse-icon" style="width:64px; height:64px; border-radius:999px; background: var(--navi-mint);"></div>
      <p class="title">You're close!</p>
      <p class="subtitle">Find ${escapeHtml(session.partnerName || "each other")}, then confirm below.</p>
      <button id="confirm" class="pill-button">We met!</button>
    </div>
  `;

  const confirmBtn = app.querySelector<HTMLButtonElement>("#confirm")!;
  confirmBtn.onclick = () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Confirmed…";
    session.channel?.send({ type: "phase", value: "reunited" });
  };

  return { stop: () => {} };
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
