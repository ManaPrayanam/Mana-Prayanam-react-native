export type MapCoords = { lat: number; lng: number };

/** Reverse-geocode via Nominatim (OpenStreetMap). Debounce callers. */
export async function reverseGeocode(coords: MapCoords): Promise<string> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      // Nominatim usage policy: identify the app
      'User-Agent': 'ManaPrayanam/1.0 (ride booking demo)',
    },
  });
  if (!res.ok) throw new Error('Could not look up address');
  const data = (await res.json()) as { display_name?: string };
  if (!data.display_name) throw new Error('No address found');
  return data.display_name;
}
