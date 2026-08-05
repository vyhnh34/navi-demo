import type { Role } from "../types";
import type { RoomChannel } from "./channel";

/** Single mutable session object shared across screens — no framework, no store library. */
export interface SessionState {
  name: string;
  role: Role;
  roomCode: string;
  channel: RoomChannel | null;
  partnerName: string;
}

export const session: SessionState = {
  name: "",
  role: "hider",
  roomCode: "NAVI",
  channel: null,
  partnerName: "",
};
