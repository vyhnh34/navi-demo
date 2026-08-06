import type { Role } from "../types";
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
}

export const session: SessionState = {
  name: "",
  role: "hider",
  roomCode: "NAVI",
  channel: null,
  partnerName: "",
  rewardFunsie: null,
};
