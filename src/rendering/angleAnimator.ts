/**
 * Eases the pixel cluster's displayed angle between sector changes, matching
 * `NavigateView.swift`'s `withAnimation(.easeInOut(duration: 0.45))` + "nearest equivalent
 * angle" unwrap so a NW -> N change animates 45 degrees forward, not 315 degrees back.
 */
const DURATION_MS = 450;

export class AngleAnimator {
  private current: number;
  private from = 0;
  private target = 0;
  private startTime = 0;
  private rafId: number | null = null;
  private readonly onUpdate: (angle: number) => void;

  constructor(onUpdate: (angle: number) => void, initial = 0) {
    this.onUpdate = onUpdate;
    this.current = initial;
    this.onUpdate(this.current);
  }

  setImmediate(angle: number): void {
    this.stop();
    this.current = angle;
    this.onUpdate(this.current);
  }

  animateTo(targetAngle: number): void {
    const nearest = nearestEquivalentAngle(targetAngle, this.current);
    this.from = this.current;
    this.target = nearest;
    this.startTime = performance.now();
    this.stop();
    const step = (now: number) => {
      const elapsed = now - this.startTime;
      const progress = Math.min(1, elapsed / DURATION_MS);
      const eased = easeInOut(progress);
      this.current = this.from + (this.target - this.from) * eased;
      this.onUpdate(this.current);
      if (progress < 1) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(step);
  }

  stop(): void {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}

function nearestEquivalentAngle(target: number, current: number): number {
  let delta = target - (current % 360);
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return current + delta;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
