export type Role = "hider" | "finder";

export type Phase = "lobby" | "walking" | "navigating" | "close" | "reunited" | "reward";

export type FriendColorName = "mint" | "pink" | "cyan" | "amber";

/** Mirrors the native app's `FunsieSource` (`.systemGenerated` / `.userDrawn`), never wired
 * into a UI there — this trail is that UI. */
export type FunsieSource = "auto" | "drawn";

export interface JoinEvent {
  type: "join";
  role: Role;
  name: string;
}

export interface PositionEvent {
  type: "position";
  lat: number;
  lon: number;
  accuracy: number;
  headingDeg: number | null;
  updatedAt: number;
}

export interface HiderPositionEvent {
  type: "hider-position";
  lat: number;
  lon: number;
  accuracy: number;
  updatedAt: number;
}

export interface FunsieSentEvent {
  type: "funsie-sent";
  cells: number[];
  color: string;
}

export interface PhaseEvent {
  type: "phase";
  value: Phase;
}

/** One breadcrumb dropped along the Hider's walk to their hiding spot — either the
 * distance-triggered procedural kind or a hand-drawn one, distinguished by `source`. */
export interface FunsieDrop {
  id: string;
  lat: number;
  lon: number;
  cells: number[];
  color: string;
  droppedAt: number;
  source: FunsieSource;
}

/** Hider -> channel, sent once per drop as it happens. */
export type FunsieDroppedEvent = FunsieDrop & { type: "funsie-dropped" };

/** Finder -> channel, sent once a dropped funsie's proximity threshold is reached. */
export interface FunsieCollectedEvent {
  type: "funsie-collected";
  id: string;
}

/** Finder -> channel, sent on (re)join so a late-joining or reconnecting Finder can
 * catch up on everything dropped so far — Broadcast alone has no memory of its own. */
export interface RequestSyncEvent {
  type: "request-sync";
}

/** Hider -> channel, reply to `request-sync` with the full trail dropped so far
 * (minus anything already marked collected). */
export interface SyncEvent {
  type: "sync";
  drops: FunsieDrop[];
}

export type RoomEvent =
  | JoinEvent
  | PositionEvent
  | HiderPositionEvent
  | FunsieSentEvent
  | PhaseEvent
  | FunsieDroppedEvent
  | FunsieCollectedEvent
  | RequestSyncEvent
  | SyncEvent;

export interface PresenceState {
  role: Role;
  name: string;
}

export interface LatLon {
  lat: number;
  lon: number;
  accuracy: number;
  updatedAt: number;
}
