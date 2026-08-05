export interface LatLonAccuracy {
  lat: number;
  lon: number;
  accuracy: number;
}

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Haversine great-circle distance in meters. */
export function haversineMeters(a: LatLonAccuracy, b: LatLonAccuracy): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Absolute bearing in degrees (0-360, 0 = north) from `a` to `b`. */
export function bearingDegrees(a: LatLonAccuracy, b: LatLonAccuracy): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function requestGeolocationOnce(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
  });
}

export function watchPosition(
  onUpdate: (pos: GeolocationPosition) => void,
  onError: (err: GeolocationPositionError) => void
): () => void {
  const id = navigator.geolocation.watchPosition(onUpdate, onError, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 20000,
  });
  return () => navigator.geolocation.clearWatch(id);
}

/** iOS 13+ gates DeviceOrientationEvent behind an explicit, tap-triggered permission request.
 * Other browsers have no such gate and the event just fires. */
export async function requestOrientationPermission(): Promise<boolean> {
  const DOE = (window as any).DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    try {
      const result = await DOE.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }
  return true;
}

function currentScreenAngle(): number {
  if (typeof screen !== "undefined" && screen.orientation && typeof screen.orientation.angle === "number") {
    return screen.orientation.angle;
  }
  return (window as any).orientation ?? 0;
}

/** Compass heading in degrees, 0-360, 0 = north, clockwise. iOS reports `webkitCompassHeading`
 * directly (already screen-orientation-compensated); other browsers report `alpha` from
 * `deviceorientationabsolute`, which needs a manual conversion + screen-angle compensation. */
export function watchHeading(onHeading: (deg: number) => void): () => void {
  let screenAngle = currentScreenAngle();

  const handler = (e: DeviceOrientationEvent) => {
    const webkitHeading = (e as any).webkitCompassHeading;
    let heading: number | null = null;
    if (typeof webkitHeading === "number") {
      heading = webkitHeading;
    } else if (typeof e.alpha === "number") {
      heading = 360 - e.alpha + screenAngle;
    }
    if (heading != null) {
      onHeading(((heading % 360) + 360) % 360);
    }
  };

  const updateScreenAngle = () => {
    screenAngle = currentScreenAngle();
  };

  window.addEventListener("orientationchange", updateScreenAngle);

  const eventName = "ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation";
  window.addEventListener(eventName, handler as EventListener, true);

  return () => {
    window.removeEventListener(eventName, handler as EventListener, true);
    window.removeEventListener("orientationchange", updateScreenAngle);
  };
}
