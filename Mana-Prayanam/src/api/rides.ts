import type { MapCoords } from './geocode';
import { ApiError, request } from './client';

export type RideStatus = 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
export type AvailableRide = { id: string; pickup: string; destination: string; created_at: string };
export type Ride = AvailableRide & { status: RideStatus; driver_id: string | null; vehicle_id: string | null };
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
  nearbyVehicles: Array<{ id: string; lat: number; lng: number }>;
  nearbyBikes?: Array<{ id: string; lat: number; lng: number }>;
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

function nearbyAroundPickup(pickup: MapCoords) {
  const offsets = [
    { dLat: 0.00055, dLng: 0.00025 },
    { dLat: -0.00035, dLng: 0.0006 },
    { dLat: 0.0002, dLng: -0.00055 },
  ];
  return offsets.map((o, i) => ({
    id: `near-${i + 1}`,
    lat: pickup.lat + o.dLat,
    lng: pickup.lng + o.dLng,
  }));
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

  const nearbyVehicles = nearbyAroundPickup(pickup);
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
      : nearbyAroundPickup(raw.pickup);
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

export const requestRide = (token: string, pickup: string, destination: string) =>
  request<Ride>('/rides', 'POST', { pickup, destination }, token);
export const acceptRide = (token: string, id: string, vehicleId: string) =>
  request<Ride>(`/rides/${id}/accept`, 'POST', { vehicleId }, token);
export const updateRide = (token: string, id: string, status: 'in_progress' | 'completed' | 'cancelled') =>
  request<Ride>(`/rides/${id}/status`, 'PATCH', { status }, token);
export const rideHistory = (token: string, id: string) =>
  request<RideEvent[]>(`/rides/${id}/history`, 'GET', undefined, token);
