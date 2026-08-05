/** Ported palette from `NaviShared/Models/Friend.swift`'s `FriendColor`. Two-player only, so
 * instead of an assigned-by-app-state color, we derive a stable pick from the partner's name —
 * same visual behavior (a consistent per-friend tint), no extra synced state needed. */
const PALETTE = ["#8cf299", "#fa73cc", "#66ccff", "#ffb84d"];

export function friendColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index]!;
}
