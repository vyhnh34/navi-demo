import { session } from "../lib/state";
import { funsieGlyphBoundingBox, drawFunsieGlyph, easeInOutQuad } from "../rendering/funsieGlyph";

/**
 * Ported from the native app's `RewardView` (NaviPhone/Flow/RewardView.swift): "Reward" label,
 * a larger glyph reveal, colored label beneath. The native version reveals a rarity-rolled
 * funsie with a rarity-name label; this build has no rarity system, so it reveals the actual
 * hand-drawn reward funsie from hiderWait.ts (captured into `session.rewardFunsie` regardless
 * of role, see main.ts) and labels it by who drew it instead. Native auto-returns to Home
 * after a few seconds — this build has no Home/idle screen to return to, so this is the final
 * screen of the session.
 */
const REVEAL_MS = 400;
const CANVAS_CSS_SIZE = 200;

export interface RewardHandle {
  stop: () => void;
}

export function renderReward(app: HTMLElement): RewardHandle {
  const reward = session.rewardFunsie;

  app.innerHTML = `
    <div class="screen">
      <p style="font-size:14px; color: var(--navi-secondary); margin:0;">Reward</p>
      <canvas id="reward-canvas"></canvas>
      <p id="reward-label" class="title" style="margin:0;"></p>
    </div>
  `;

  const label = app.querySelector<HTMLParagraphElement>("#reward-label")!;

  if (!reward) {
    label.textContent = "No funsie made it this time";
    label.style.color = "var(--navi-secondary)";
    app.querySelector<HTMLCanvasElement>("#reward-canvas")!.style.display = "none";
    return { stop: () => {} };
  }

  label.textContent =
    session.role === "hider"
      ? `Your gift to ${session.partnerName || "your friend"}`
      : `From ${session.partnerName || "your friend"}`;
  label.style.color = reward.color;

  const canvas = app.querySelector<HTMLCanvasElement>("#reward-canvas")!;
  const ctx = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${CANVAS_CSS_SIZE}px`;
  canvas.style.height = `${CANVAS_CSS_SIZE}px`;
  canvas.width = CANVAS_CSS_SIZE * dpr;
  canvas.height = CANVAS_CSS_SIZE * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const box = funsieGlyphBoundingBox(reward.cells);

  let start: number | null = null;
  let raf = 0;
  const frame = (ts: number): void => {
    if (start === null) start = ts;
    const t = Math.min(1, (ts - start) / REVEAL_MS);
    drawFunsieGlyph(ctx, reward.cells, reward.color, box, easeInOutQuad(t), CANVAS_CSS_SIZE);
    if (t < 1) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    stop: () => cancelAnimationFrame(raf),
  };
}
