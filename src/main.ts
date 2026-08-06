import "./style.css";
import { renderJoin } from "./screens/join";
import { renderPermission } from "./screens/permission";
import { renderHiderWalking } from "./screens/hiderWalking";
import { renderHiderWait } from "./screens/hiderWait";
import { renderNavigate } from "./screens/navigate";
import { renderConfirmMeet } from "./screens/confirmMeet";
import { renderReunited } from "./screens/reunited";
import { renderReward } from "./screens/reward";
import { session } from "./lib/state";
import { FunsieTrail } from "./lib/funsieTrail";
import type { Phase } from "./types";

const app = document.querySelector<HTMLDivElement>("#app")!;

/** Whichever screen is currently mounted, torn down before the next one mounts — needed once
 * phase-driven transitions (close/reunited/reward) can replace a screen out from under it
 * regardless of which client triggered the transition. */
let stopCurrentScreen: (() => void) | null = null;
let currentPhase: Phase | null = null;

function mount(handle: { stop: () => void }): void {
  stopCurrentScreen?.();
  stopCurrentScreen = handle.stop;
}

/** The one path responsible for mounting phase-driven screens — a tap that triggers a
 * transition and the network echo of someone else's tap both flow through here, so neither
 * screen ever mounts the next one directly. Guarded on `currentPhase` so redundant events for
 * a phase already showing (e.g. both clients' Reunited timers each broadcasting "reward")
 * don't restart that screen's reveal animation. */
function handlePhase(value: Phase): void {
  if (value === currentPhase) return;
  currentPhase = value;

  if (value === "close") {
    mount(renderConfirmMeet(app));
  } else if (value === "reunited") {
    mount(renderReunited(app));
  } else if (value === "reward") {
    mount(renderReward(app));
  }
}

function onReady(): void {
  session.channel?.on("phase", (e) => handlePhase(e.value));
  session.channel?.on("funsie-sent", (e) => {
    session.rewardFunsie = { cells: e.cells, color: e.color };
  });

  renderPermission(app, (opts) => {
    if (session.role === "hider") {
      const trail = new FunsieTrail(session.channel!);
      mount(
        renderHiderWalking(app, trail, () => {
          mount(renderHiderWait(app));
        })
      );
    } else {
      mount(renderNavigate(app, opts));
    }
  });
}

renderJoin(app, onReady);
