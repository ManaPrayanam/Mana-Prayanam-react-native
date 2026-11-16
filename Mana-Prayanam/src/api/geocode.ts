export type MapCoords = { lat: number; lng: number };

export type PlaceHit = {
  label: string;
  coords: MapCoords;
  distanceKm?: number;
};

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'ManaPrayanam/1.0 (ride booking demo)',
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

/** Reverse-geocode via Nominatim (OpenStreetMap). Debounce callers. */
export async function reverseGeocode(coords: MapCoords): Promise<string> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) throw new Error('Could not look up address');
  const data = (await res.json()) as { display_name?: string };
  if (!data.display_name) throw new Error('No address found');
  return data.display_name;
}

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    type?: string;
  };
};

function photonLabel(p: NonNullable<PhotonFeature['properties']>) {
  const parts = [
    [p.housenumber, p.street].filter(Boolean).join(' '),
    p.name,
    p.district,
    p.city || p.county,
    p.state,
  ].filter((part) => part && part.trim().length > 0);
  // Dedupe consecutive repeats
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.length || unique[unique.length - 1] !== part) unique.push(part as string);
  }
  return unique.join(', ');
}

/**
 * Autocomplete search via Photon (OSM), biased to GPS.
 * Handles short prefixes like "yel" → Yelahanka near the user — no hardcoded place list.
 */
export async function searchPlaces(query: string, near?: MapCoords): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    limit: '20',
    lang: 'en',
  });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
    // Stronger pull toward the user's location for short prefixes.
    params.set('location_bias_scale', '0.2');
  }

  const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'ManaPrayanam/1.0 (ride booking demo)' },
  });
  if (!res.ok) throw new Error('Could not search places');

  const data = (await res.json()) as { features?: PhotonFeature[] };
  const hits: PlaceHit[] = [];
  const seen = new Set<string>();

  for (const feature of data.features ?? []) {
    const props = feature.properties;
    const coordsPair = feature.geometry?.coordinates;
    if (!props || !coordsPair || coordsPair.length < 2) continue;

    // Keep India results when country is known.
    const cc = (props.countrycode || '').toLowerCase();
    if (cc && cc !== 'in') continue;

    const lng = Number(coordsPair[0]);
    const lat = Number(coordsPair[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const label = photonLabel(props);
    if (!label) continue;

    const key = `${label}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const coords = { lat, lng };
    hits.push({
      label,
      coords,
      distanceKm: near ? haversineKm(near, coords) : undefined,
    });
  }

  if (near) {
    hits.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  return hits;
}
