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
  pickupLabel: string;
  dropLabel: string;
  bottomPadRatio?: number;
};

function makeHtml(
  pickup: MapCoords,
  drop: MapCoords,
  route: [number, number][],
  nearby: Array<{ lat: number; lng: number }>,
  vehicleIcon: string,
  pickupLabel: string,
  dropLabel: string,
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
html,body,#map{margin:0;width:100%;height:100%;background:#e8eee9}
.dot{width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.dot-pick{background:#2563EB}
.dot-drop{background:#159447;width:16px;height:16px}
.fleet-wrap{width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:transparent}
.fleet{width:38px;height:38px;object-fit:contain;background:transparent;border:0;border-radius:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
.tag{background:#fff;border-radius:16px;padding:6px 10px;font:600 12px -apple-system,BlinkMacSystemFont,sans-serif;color:#111827;box-shadow:0 2px 8px rgba(0,0,0,.18);white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis}
</style>
</head><body><div id="map"></div>
<script>
const post = (payload) => window.ReactNativeWebView.postMessage(JSON.stringify(payload));
const pickup = ${JSON.stringify([pickup.lng, pickup.lat])};
const drop = ${JSON.stringify([drop.lng, drop.lat])};
const route = ${JSON.stringify(line)};
const nearby = ${JSON.stringify(nearby)};
const vehicleIcon = ${JSON.stringify(vehicleIcon)};
const pickupLabel = ${JSON.stringify(pickupLabel)};
const dropLabel = ${JSON.stringify(dropLabel)};
const bottomPad = ${JSON.stringify(bottomPadRatio)};

function shortLabel(text) {
  const t = String(text || '');
  return t.length > 18 ? t.slice(0, 17) + '…' : t;
}

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
      id: 'route-glow',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#86EFAC', 'line-width': 10, 'line-opacity': 0.55 }
    });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#159447', 'line-width': 5, 'line-opacity': 1 }
    });

    const pickDot = document.createElement('div');
    pickDot.className = 'dot dot-pick';
    new maplibregl.Marker({ element: pickDot }).setLngLat(pickup).addTo(map);

    const dropDot = document.createElement('div');
    dropDot.className = 'dot dot-drop';
    new maplibregl.Marker({ element: dropDot }).setLngLat(drop).addTo(map);

    const pickTag = document.createElement('div');
    pickTag.className = 'tag';
    pickTag.textContent = shortLabel(pickupLabel);
    new maplibregl.Marker({ element: pickTag, offset: [0, -28] }).setLngLat(pickup).addTo(map);

    const dropTag = document.createElement('div');
    dropTag.className = 'tag';
    dropTag.textContent = shortLabel(dropLabel);
    new maplibregl.Marker({ element: dropTag, offset: [0, -28] }).setLngLat(drop).addTo(map);

    nearby.forEach((b, i) => {
      const wrap = document.createElement('div');
      wrap.className = 'fleet-wrap';
      const img = document.createElement('img');
      img.className = 'fleet';
      img.src = vehicleIcon;
      img.style.transform = 'rotate(' + ((i * 37) % 60 - 30) + 'deg)';
      wrap.appendChild(img);
      new maplibregl.Marker({ element: wrap, anchor: 'center' }).setLngLat([b.lng, b.lat]).addTo(map);
    });

    const bounds = new maplibregl.LngLatBounds(pickup, pickup);
    route.forEach((c) => bounds.extend(c));
    bounds.extend(drop);
    nearby.forEach((b) => bounds.extend([b.lng, b.lat]));
    const h = map.getContainer().clientHeight;
    map.fitBounds(bounds, {
      padding: { top: 72, left: 44, right: 44, bottom: Math.round(h * bottomPad) + 36 },
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
  pickupLabel,
  dropLabel,
  bottomPadRatio = 0.5,
}: Props) {
  const [failed, setFailed] = useState(false);
  const icon = vehicle === 'auto' ? AUTO_MARKER_DATA_URI : BIKE_MARKER_DATA_URI;
  const source = useMemo(
    () => ({
      html: makeHtml(
        pickup,
        drop,
        route,
        nearby,
        icon,
        pickupLabel,
        dropLabel,
        bottomPadRatio,
      ),
    }),
    [pickup, drop, route, nearby, icon, pickupLabel, dropLabel, bottomPadRatio],
  );

  return (
    <View style={styles.container}>
      <WebView
        key={`${vehicle}-${nearby.length}`}
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
  container: { ...StyleSheet.absoluteFill, backgroundColor: '#E8EEE9' },
  error: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    backgroundColor: '#fff',
    padding: 8,
  },
});
