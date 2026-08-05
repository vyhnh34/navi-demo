/** Ported from `NaviShared/Models/FriendLocation.swift`'s `CompassSector`. */
export const SECTORS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Sector = (typeof SECTORS)[number];

const SECTOR_WIDTH = 360 / SECTORS.length;

export function sectorCenterDegrees(sector: Sector): number {
  return SECTORS.indexOf(sector) * SECTOR_WIDTH;
}

function nearestSector(bearing: number): Sector {
  const index = Math.floor(((bearing + SECTOR_WIDTH / 2) % 360) / SECTOR_WIDTH);
  return SECTORS[index]!;
}

/** Snaps a continuous bearing to the nearest of 8 sectors, with hysteresis around the
 * previous sector's boundary so the result doesn't flicker while the bearing hovers at
 * an edge. */
export function snapSector(bearingDegrees: number, previous: Sector | null, hysteresisDegrees = 7): Sector {
  const bearing = ((bearingDegrees % 360) + 360) % 360;
  if (previous == null) return nearestSector(bearing);

  const previousCenter = sectorCenterDegrees(previous);
  let delta = bearing - previousCenter;
  delta -= 360 * Math.round(delta / 360);

  if (Math.abs(delta) <= SECTOR_WIDTH / 2 + hysteresisDegrees) return previous;
  return nearestSector(bearing);
}
