import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { randomId } from "./id";
import type { PresenceState, RoomEvent } from "../types";

type Listener<T> = (payload: T) => void;
type PresenceListener = (states: Record<string, PresenceState[]>) => void;

/**
 * One Supabase Realtime channel per room (`room:{roomCode}`), per PRD section 7.
 * No table, no persistence — Broadcast carries game events, Presence tracks who's joined.
 */
export class RoomChannel {
  readonly roomCode: string;
  private channel: RealtimeChannel;
  private listeners = new Map<RoomEvent["type"], Set<Listener<any>>>();
  private presenceListeners = new Set<PresenceListener>();

  constructor(roomCode: string) {
    this.roomCode = roomCode.trim().toUpperCase();
    this.channel = supabase.channel(`room:${this.roomCode}`, {
      config: {
        broadcast: { self: true },
        presence: { key: randomId() },
      },
    });

    this.channel.on("broadcast", { event: "room-event" }, ({ payload }) => {
      this.dispatch(payload as RoomEvent);
    });

    this.channel.on("presence", { event: "sync" }, () => {
      const state = this.channel.presenceState<PresenceState>();
      this.presenceListeners.forEach((fn) => fn(state));
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.channel.subscribe((status, err) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(err ?? new Error(status));
        }
      });
    });
  }

  async trackPresence(state: PresenceState): Promise<void> {
    await this.channel.track(state);
  }

  send(event: RoomEvent): void {
    this.channel.send({ type: "broadcast", event: "room-event", payload: event });
  }

  on<T extends RoomEvent["type"]>(
    type: T,
    fn: Listener<Extract<RoomEvent, { type: T }>>
  ): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn as Listener<any>);
    return () => this.listeners.get(type)?.delete(fn as Listener<any>);
  }

  onPresence(fn: PresenceListener): () => void {
    this.presenceListeners.add(fn);
    return () => this.presenceListeners.delete(fn);
  }

  private dispatch(event: RoomEvent): void {
    this.listeners.get(event.type)?.forEach((fn) => fn(event));
  }

  disconnect(): void {
    supabase.removeChannel(this.channel);
  }
}
