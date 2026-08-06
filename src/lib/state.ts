import type { FunsieDrop, Role } from "../types";
import type { RoomChannel } from "./channel";

export interface RewardFunsie {
  cells: number[];
  color: string;
}

/** Single mutable session object shared across screens — no framework, no store library. */
export interface SessionState {
  name: string;
  role: Role;
  roomCode: string;
  channel: RoomChannel | null;
  partnerName: string;
  /** Latest hand-drawn reward funsie sent via `funsie-sent` (hiderWait.ts), captured
   * regardless of role (self-broadcast included) so it's ready by the time Reunion needs it. */
  rewardFunsie: RewardFunsie | null;
  /** Every trail funsie collected this session (auto or drawn), for the "Funsies collection"
   * view from Reward. Populated on both roles from data each already tracks locally — the
   * Finder appends as it marks drops collected (navigate.ts), the Hider appends from its
   * FunsieTrail's own collected-id bookkeeping (funsieTrail.ts) — no extra sync needed. */
  collectedFunsies: FunsieDrop[];
}

export const session: SessionState = {
  name: "",
  role: "hider",
  roomCode: "NAVI",
  channel: null,
  partnerName: "",
  rewardFunsie: null,
  collectedFunsies: [],
};
