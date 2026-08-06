import type { RoomChannel } from "./channel";
import { randomId } from "./id";
import { haversineMeters, type LatLonAccuracy } from "./geo";
import { generateAutoFunsieCells, randomFunsieSeed } from "./funsiePattern";
import { randomFunsieColor } from "./funsiePalette";
import { session } from "./state";
import type { FunsieDrop } from "../types";

const MIN_AUTO_DROP_METERS = 8;
const MAX_AUTO_DROP_METERS = 12;

/**
 * Hider-side trail state for the "walking to hide" phase (PRD section 5/6, architecture
 * Option B): the Hider's client is the source of truth for the trail dropped so far, kept in
 * memory and broadcast as it happens. A (re)joining Finder catches up by broadcasting
 * `request-sync`; this replies with everything dropped so far, minus anything already marked
 * collected, over the same Broadcast channel — no separate table needed.
 */
export class FunsieTrail {
  /** Fires after every recorded drop (auto or drawn) — screens use this to update a
   * drop counter without needing to duplicate the trail's own bookkeeping. */
  onDrop: ((drop: FunsieDrop) => void) | null = null;

  private drops: FunsieDrop[] = [];
  private collectedIds = new Set<string>();
  private lastDropPos: LatLonAccuracy | null = null;
  private nextThresholdM = randomAutoThreshold();
  private channel: RoomChannel;

  constructor(channel: RoomChannel) {
    this.channel = channel;
    this.channel.on("request-sync", () => {
      this.channel.send({
        type: "sync",
        drops: this.drops.filter((d) => !this.collectedIds.has(d.id)),
      });
    });
    this.channel.on("funsie-collected", (e) => {
      if (this.collectedIds.has(e.id)) return;
      this.collectedIds.add(e.id);
      const drop = this.drops.find((d) => d.id === e.id);
      if (drop) session.collectedFunsies.push(drop);
    });
  }

  /** Feed every raw position update while walking; drops an auto funsie once the Hider has
   * moved past the current random 8-12m threshold since the last drop. */
  onPosition(pos: LatLonAccuracy): void {
    if (!this.lastDropPos) {
      this.lastDropPos = pos;
      return;
    }
    const moved = haversineMeters(this.lastDropPos, pos);
    if (moved >= this.nextThresholdM) {
      this.dropAuto(pos);
      this.lastDropPos = pos;
      this.nextThresholdM = randomAutoThreshold();
    }
  }

  dropAuto(pos: LatLonAccuracy): void {
    this.record({
      id: randomId(),
      lat: pos.lat,
      lon: pos.lon,
      cells: generateAutoFunsieCells(randomFunsieSeed()),
      color: randomFunsieColor(),
      droppedAt: Date.now(),
      source: "auto",
    });
  }

  dropDrawn(pos: LatLonAccuracy, cells: number[], color: string): void {
    this.record({
      id: randomId(),
      lat: pos.lat,
      lon: pos.lon,
      cells,
      color,
      droppedAt: Date.now(),
      source: "drawn",
    });
  }

  private record(drop: FunsieDrop): void {
    this.drops.push(drop);
    this.channel.send({ type: "funsie-dropped", ...drop });
    this.onDrop?.(drop);
  }
}

function randomAutoThreshold(): number {
  return MIN_AUTO_DROP_METERS + Math.random() * (MAX_AUTO_DROP_METERS - MIN_AUTO_DROP_METERS);
}
