export type MapCoords = { lat: number; lng: number };

export type PlaceHit = {
  label: string;
  coords: MapCoords;
};

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  // Nominatim usage policy: identify the app
  'User-Agent': 'ManaPrayanam/1.0 (ride booking demo)',
} as const;

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

/** Forward-geocode / place search via Nominatim. Debounce callers. */
export async function searchPlaces(query: string, near?: MapCoords): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({
    format: 'jsonv2',
    q,
    addressdetails: '1',
    limit: '6',
    countrycodes: 'in',
  });
  if (near) {
    params.set(
      'viewbox',
      `${near.lng - 0.35},${near.lat + 0.35},${near.lng + 0.35},${near.lat - 0.35}`,
    );
    params.set('bounded', '0');
  }
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: NOMINATIM_HEADERS },
  );
  if (!res.ok) throw new Error('Could not search places');
  const data = (await res.json()) as Array<{
    display_name?: string;
    name?: string;
    lat?: string;
    lon?: string;
  }>;
  return data
    .map((row) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      const label = row.display_name || row.name;
      if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { label, coords: { lat, lng } };
    })
    .filter((hit): hit is PlaceHit => hit != null);
}
