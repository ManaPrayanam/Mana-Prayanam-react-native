import { useMemo, useState, type ComponentType, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NativeWebView from 'react-native-webview';
import type { MapCoords } from '@/api/geocode';
import { AUTO_MARKER_DATA_URI, BIKE_MARKER_DATA_URI } from '@/components/vehicle-marker-data';

type MapWebViewHandle = { injectJavaScript: (script: string) => void };
const WebView = NativeWebView as unknown as ComponentType<{
  ref?: Ref<MapWebViewHandle>;
  source: { html: string };
  originWhitelist: string[];
  onShouldStartLoadWithRequest: (request: { url: string }) => boolean;
  applicationNameForUserAgent: string;
  scrollEnabled: boolean;
  onError: () => void;
  onMessage: (event: { nativeEvent: { data: string } }) => void;
}>;

type Props = {
  pickup: MapCoords;
  drop: MapCoords;
  route: [number, number][];
  nearby: Array<{ lat: number; lng: number }>;
  vehicle: 'bike' | 'auto';
  bottomPadRatio?: number;
};

function makeHtml(
  pickup: MapCoords,
  drop: MapCoords,
  route: [number, number][],
  nearby: Array<{ lat: number; lng: number }>,
  vehicleIcon: string,
  bottomPadRatio: number,
) {
  const line = route.length >= 2
    ? route
    : ([[pickup.lng, pickup.lat], [drop.lng, drop.lat]] as [number, number][]);

  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js"></script>
<style>
html,body,#map{margin:0;width:100%;height:100%;background:#d5ddd9}
.pin{width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.pin-pick{background:#159447}
.pin-drop{background:#E67E22;width:18px;height:18px}
.fleet{width:36px;height:36px;border-radius:18px;background:#fff;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);object-fit:contain}
</style>
</head><body><div id="map"></div>
<script>
const post = (payload) => window.ReactNativeWebView.postMessage(JSON.stringify(payload));
const pickup = ${JSON.stringify([pickup.lng, pickup.lat])};
const drop = ${JSON.stringify([drop.lng, drop.lat])};
const route = ${JSON.stringify(line)};
const nearby = ${JSON.stringify(nearby)};
const vehicleIcon = ${JSON.stringify(vehicleIcon)};
const bottomPad = ${JSON.stringify(bottomPadRatio)};
try {
  const map = new maplibregl.Map({
    container:'map',
    center: pickup,
    zoom: 14,
    maxZoom: 18,
    dragRotate: false,
    pitchWithRotate: false,
    style: { version: 8, sources: { streets: { type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap' } },
      layers: [{ id: 'streets', type: 'raster', source: 'streets' }] }
  });

  map.on('load', () => {
    map.addSource('route', {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } }
    });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#159447', 'line-width': 5, 'line-opacity': 0.95 }
    });

    const elPick = document.createElement('div');
    elPick.className = 'pin pin-pick';
    new maplibregl.Marker({ element: elPick }).setLngLat(pickup).addTo(map);

    const elDrop = document.createElement('div');
    elDrop.className = 'pin pin-drop';
    new maplibregl.Marker({ element: elDrop }).setLngLat(drop).addTo(map);

    nearby.slice(0, 3).forEach((b) => {
      const img = document.createElement('img');
      img.className = 'fleet';
      img.src = vehicleIcon;
      img.alt = 'nearby';
      new maplibregl.Marker({ element: img, anchor: 'center' }).setLngLat([b.lng, b.lat]).addTo(map);
    });

    const bounds = new maplibregl.LngLatBounds(pickup, pickup);
    route.forEach((c) => bounds.extend(c));
    bounds.extend(drop);
    nearby.forEach((b) => bounds.extend([b.lng, b.lat]));
    const h = map.getContainer().clientHeight;
    map.fitBounds(bounds, {
      padding: { top: 56, left: 40, right: 40, bottom: Math.round(h * bottomPad) + 28 },
      maxZoom: 15,
      duration: 0,
    });
    post({ type: 'ready' });
  });
  map.on('error', () => post({ type: 'error' }));
} catch (_) { post({ type: 'error' }); }
</script></body></html>`;
}

export function RouteMap({
  pickup,
  drop,
  route,
  nearby,
  vehicle,
  bottomPadRatio = 0.46,
}: Props) {
  const [failed, setFailed] = useState(false);
  const icon = vehicle === 'auto' ? AUTO_MARKER_DATA_URI : BIKE_MARKER_DATA_URI;
  const source = useMemo(
    () => ({ html: makeHtml(pickup, drop, route, nearby, icon, bottomPadRatio) }),
    [pickup, drop, route, nearby, icon, bottomPadRatio],
  );

  return (
    <View style={styles.container}>
      <WebView
        key={vehicle}
        source={source}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={({ url }) => url === 'about:blank' || url.startsWith('data:text/html')}
        applicationNameForUserAgent="ManaPrayanam/1.0"
        scrollEnabled={false}
        onError={() => setFailed(true)}
        onMessage={({ nativeEvent }) => {
          try {
            const message = JSON.parse(nativeEvent.data);
            if (message.type === 'error') setFailed(true);
            if (message.type === 'ready') setFailed(false);
          } catch {
            // ignore
          }
        }}
      />
      {failed ? (
        <Text accessibilityRole="alert" style={styles.error}>Map unavailable. Check your connection.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, backgroundColor: '#D5DDD9' },
  error: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    padding: 8,
  },
});
