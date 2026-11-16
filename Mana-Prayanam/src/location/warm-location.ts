import * as Location from 'expo-location';
import type { MapCoords } from '@/api/geocode';

const MAX_LOCATION_AGE_MS = 120_000;

let cached: MapCoords | null = null;
let cachedAt = 0;
let pending: Promise<MapCoords | null> | null = null;

export function peekLocation(): MapCoords | null {
  return Date.now() - cachedAt <= MAX_LOCATION_AGE_MS ? cached : null;
}

/** Start GPS while the user is still on login/OTP so home does not wait. */
export function warmLocation(): Promise<MapCoords | null> {
  const recent = peekLocation();
  if (recent) return Promise.resolve(recent);
  if (pending) return pending;

  pending = (async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      const permission = current.status === 'granted'
        ? current
        : await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return peekLocation();

      const last = await Location.getLastKnownPositionAsync({ maxAge: MAX_LOCATION_AGE_MS });
      if (last) {
        cachedAt = last.timestamp;
        cached = { lat: last.coords.latitude, lng: last.coords.longitude };
      }

      try {
        const quick = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
        cachedAt = quick.timestamp;
        cached = { lat: quick.coords.latitude, lng: quick.coords.longitude };
      } catch {
        // last-known is enough to open the map
      }
      return peekLocation();
    } catch {
      return peekLocation();
    } finally {
      pending = null;
    }
  })();

  return pending;
}
