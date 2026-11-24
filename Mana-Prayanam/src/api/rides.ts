import type { MapCoords } from './geocode';
import { ApiError, request } from './client';

export type RideStatus = 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
export type AvailableRide = { id: string; pickup: string; destination: string; created_at: string };
export type Ride = AvailableRide & {
  status: RideStatus;
  driver_id: string | null;
  vehicle_id: string | null;
  start_otp?: string | null;
  vehicle_type?: 'bike' | 'auto' | null;
};
export type RideEvent = { status: RideStatus; actor_id: string; created_at: string };

export type VehicleQuote = {
  vehicle: 'bike' | 'auto';
  fareInr: number;
  durationMin: number;
  distanceKm: number;
};

export type RideQuote = {
  pickup: MapCoords;
  drop: MapCoords;
  distanceKm: number;
  durationMin: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  nearbyVehicles: Array<{ id: string; lat: number; lng: number; bearing?: number }>;
  nearbyBikes?: Array<{ id: string; lat: number; lng: number; bearing?: number }>;
  quotes: { bike: VehicleQuote; auto: VehicleQuote };
};

const FARE = {
  bike: { base: 20, perKm: 8, minimum: 20, etaMinutesPerKm: 3.2 },
  auto: { base: 30, perKm: 12, minimum: 30, etaMinutesPerKm: 3.8 },
} as const;

function haversineKm(a: MapCoords, b: MapCoords) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fareFor(vehicle: 'bike' | 'auto', distanceKm: number): VehicleQuote {
  const rate = FARE[vehicle];
  const fareInr = Math.round(Math.max(rate.minimum, rate.base + distanceKm * rate.perKm));
  const durationMin = Math.max(2, Math.round(distanceKm * rate.etaMinutesPerKm));
  return { vehicle, fareInr, durationMin, distanceKm: Math.round(distanceKm * 10) / 10 };
}

function nearbyFallback(pickup: MapCoords) {
  const offsets = [
    { dLat: 0.00055, dLng: 0.00012 },
    { dLat: 0.00028, dLng: 0.0006 },
    { dLat: -0.00018, dLng: 0.0007 },
    { dLat: -0.00055, dLng: 0.00022 },
    { dLat: -0.00035, dLng: -0.0005 },
    { dLat: 0.00022, dLng: -0.00058 },
  ];
  return offsets.map((o, i) => ({
    id: `near-${i + 1}`,
    lat: pickup.lat + o.dLat,
    lng: pickup.lng + o.dLng,
    bearing: (i * 55) % 360,
  }));
}

/**
 * Place available fleet on real nearby roads (not buildings / not the trip line).
 * Shoots short OSRM drives in several directions so each bike sits on a driveable lane.
 */
async function nearbyOnNearbyRoads(pickup: MapCoords) {
  const bearings = [20, 70, 115, 165, 210, 260, 305, 350];
  const cosLat = Math.cos((pickup.lat * Math.PI) / 180);
  const spots = await Promise.all(
    bearings.slice(0, 6).map(async (deg, i) => {
      const rad = (deg * Math.PI) / 180;
      const distKm = 0.07 + (i % 3) * 0.035; // ~70–140 m away
      const dest = {
        lat: pickup.lat + (distKm / 111.32) * Math.cos(rad),
        lng: pickup.lng + (distKm / (111.32 * Math.max(cosLat, 0.2))) * Math.sin(rad),
      };
      try {
        const route = await fetchOsrmRoute(pickup, dest);
        const coords = route.geometry!.coordinates;
        // Sit on that nearby road, a bit away from the pickup pin
        const idx = Math.max(
          1,
          Math.min(coords.length - 1, Math.floor(coords.length * (0.45 + (i % 3) * 0.12))),
        );
        const [lng, lat] = coords[idx];
        const prev = coords[Math.max(0, idx - 1)];
        // Geographic bearing clockwise from north (degrees)
        let bearing = (Math.atan2(lng - prev[0], lat - prev[1]) * 180) / Math.PI;
        bearing = ((bearing % 360) + 360) % 360;
        // Prefer the "upright" direction along the road (not reverse/upside-down)
        if (bearing > 90 && bearing < 270) bearing = (bearing + 180) % 360;
        return { id: `near-${i + 1}`, lat, lng, bearing };
      } catch {
        return {
          id: `near-${i + 1}`,
          lat: dest.lat,
          lng: dest.lng,
          bearing: deg,
        };
      }
    }),
  );
  return spots;
}

async function fetchOsrmRoute(pickup: MapCoords, drop: MapCoords) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${drop.lng},${drop.lat}`
    + '?overview=full&geometries=geojson';
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error('routing failed');
  const data = (await res.json()) as {
    routes?: Array<{
      distance: number;
      duration: number;
      geometry?: { coordinates: [number, number][] };
    }>;
  };
  const route = data.routes?.[0];
  if (!route?.distance || !route.geometry?.coordinates?.length) throw new Error('no route');
  return route;
}

/** Build quote with real road geometry via OSRM (client fallback). */
export async function buildLocalQuote(pickup: MapCoords, drop: MapCoords): Promise<RideQuote> {
  let distanceKm = Math.max(0.3, haversineKm(pickup, drop) * 1.3);
  let durationSec = Math.round(distanceKm * 180);
  let coordinates: [number, number][] = [
    [pickup.lng, pickup.lat],
    [drop.lng, drop.lat],
  ];

  try {
    const route = await fetchOsrmRoute(pickup, drop);
    distanceKm = Math.max(0.3, route.distance / 1000);
    durationSec = Math.round(route.duration || durationSec);
    coordinates = route.geometry!.coordinates;
  } catch {
    // straight fallback only if OSRM is unreachable
  }

  const nearbyVehicles = await nearbyOnNearbyRoads(pickup).catch(() => nearbyFallback(pickup));
  return {
    pickup,
    drop,
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin: Math.max(2, Math.round(durationSec / 60)),
    geometry: { type: 'LineString', coordinates },
    nearbyVehicles,
    nearbyBikes: nearbyVehicles,
    quotes: {
      bike: fareFor('bike', distanceKm),
      auto: fareFor('auto', distanceKm),
    },
  };
}

function normalizeQuote(raw: RideQuote): RideQuote {
  const nearby = raw.nearbyVehicles?.length
    ? raw.nearbyVehicles
    : raw.nearbyBikes?.length
      ? raw.nearbyBikes
      : nearbyFallback(raw.pickup);
  return { ...raw, nearbyVehicles: nearby };
}

export const listRides = (token: string) => request<Ride[]>('/rides', 'GET', undefined, token);
export const availableRides = (token: string) => request<AvailableRide[]>('/rides/available', 'GET', undefined, token);

export async function fetchRideQuote(token: string, pickup: MapCoords, drop: MapCoords) {
  try {
    const remote = await request<RideQuote>('/rides/quote', 'POST', { pickup, drop }, token);
    const normalized = normalizeQuote(remote);
    // If hosted returned a 2-point stub, upgrade geometry via OSRM on device.
    if ((normalized.geometry?.coordinates?.length ?? 0) < 3) {
      try {
        const route = await fetchOsrmRoute(pickup, drop);
        normalized.geometry = { type: 'LineString', coordinates: route.geometry!.coordinates };
        normalized.distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        normalized.durationMin = Math.max(2, Math.round(route.duration / 60));
        normalized.quotes = {
          bike: fareFor('bike', route.distance / 1000),
          auto: fareFor('auto', route.distance / 1000),
        };
      } catch {
        // keep server quote
      }
    }
    // Always snap fleet onto real nearby roads (server still returns circle scatter).
    try {
      normalized.nearbyVehicles = await nearbyOnNearbyRoads(pickup);
      normalized.nearbyBikes = normalized.nearbyVehicles;
    } catch {
      // keep whatever we have
    }
    return normalized;
  } catch (error) {
    if (
      !(error instanceof ApiError)
      || error.status === 400
      || error.status === 404
      || error.status >= 500
    ) {
      return buildLocalQuote(pickup, drop);
    }
    throw error;
  }
}

export const requestRide = (
  token: string,
  pickup: string,
  destination: string,
  vehicle?: 'bike' | 'auto',
) =>
  request<Ride>('/rides', 'POST', { pickup, destination, vehicle }, token);
export const acceptRide = (token: string, id: string, vehicleId: string) =>
  request<Ride>(`/rides/${id}/accept`, 'POST', { vehicleId }, token);
export const updateRide = (token: string, id: string, status: 'in_progress' | 'completed' | 'cancelled') =>
  request<Ride>(`/rides/${id}/status`, 'PATCH', { status }, token);
export const rideHistory = (token: string, id: string) =>
  request<RideEvent[]>(`/rides/${id}/history`, 'GET', undefined, token);
