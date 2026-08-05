export type Role = "hider" | "finder";

export type Phase = "lobby" | "navigating" | "close" | "reunited" | "reward";

export type FriendColorName = "mint" | "pink" | "cyan" | "amber";

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

export type RoomEvent =
  | JoinEvent
  | PositionEvent
  | HiderPositionEvent
  | FunsieSentEvent
  | PhaseEvent;

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
