import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env.local and fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY."
  );
}

type RealtimeLogListener = (line: string) => void;
const realtimeLogListeners = new Set<RealtimeLogListener>();

export function onRealtimeLog(fn: RealtimeLogListener): () => void {
  realtimeLogListeners.add(fn);
  return () => realtimeLogListeners.delete(fn);
}

export const supabase = createClient(url, anonKey, {
  realtime: {
    logger: (kind, msg, data) => {
      const line = `[rt:${kind}] ${msg}${data ? " " + safeStringify(data) : ""}`;
      // eslint-disable-next-line no-console
      console.log(line);
      realtimeLogListeners.forEach((fn) => fn(line));
    },
  },
});

function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

/** Plain HTTPS reachability check, independent of the WebSocket transport — isolates
 * "can this device reach Supabase at all" from "did the socket upgrade fail". */
export async function checkRestReachability(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
    return { ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
  }
}
