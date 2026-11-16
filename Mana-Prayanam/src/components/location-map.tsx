import { forwardRef, useImperativeHandle, useRef, useState, type ComponentType, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NativeWebView from 'react-native-webview';
import type { MapCoords } from '@/api/geocode';

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

export type LocationMapHandle = {
  goTo: (coords: MapCoords, zoom?: number) => void;
  /** Keep camera + pickup point aligned with the visible map above the sheet */
  setSheetCover: (bottomPadRatio: number, focusYRatio: number) => void;
};

type Props = {
  initial: MapCoords;
  onCenterChange: (coords: MapCoords) => void;
  onReady?: () => void;
  locked?: boolean;
};

function makeHtml(initial: MapCoords) {
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js"></script>
<style>html,body,#map{margin:0;width:100%;height:100%;background:#d5ddd9}</style>
</head><body><div id="map"></div>
<script>
const post = (payload) => window.ReactNativeWebView.postMessage(JSON.stringify(payload));
window.bottomPadRatio = 0.68;
window.focusYRatio = 0.16;
try {
  const map = new maplibregl.Map({
    container:'map', center:${JSON.stringify([initial.lng, initial.lat])},
    zoom:16, maxZoom:20, dragRotate:false, pitchWithRotate:false,
    style:{version:8,sources:{streets:{type:'raster',
      tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize:256,maxzoom:19,attribution:'© OpenStreetMap contributors'}},
      layers:[{id:'streets',type:'raster',source:'streets'}]}
  });
  const pad = () => {
    const h = map.getContainer().clientHeight;
    return {top:0,left:0,right:0,bottom:Math.round(h * window.bottomPadRatio)};
  };
  const focusPoint = () => {
    const box = map.getContainer();
    return [box.clientWidth / 2, box.clientHeight * window.focusYRatio];
  };
  window.goTo = (center, zoom) => map.jumpTo({center,zoom,padding:pad()});
  window.setSheetCover = (bottomPadRatio, focusYRatio) => {
    window.bottomPadRatio = bottomPadRatio;
    window.focusYRatio = focusYRatio;
    const c = map.getCenter();
    map.jumpTo({center:[c.lng,c.lat],zoom:map.getZoom(),padding:pad()});
  };
  window.goTo(${JSON.stringify([initial.lng, initial.lat])},16);
  map.on('load', () => post({type:'ready'}));
  map.on('error', () => post({type:'error'}));
  map.on('idle', () => { if (map.areTilesLoaded()) post({type:'idle'}); });
  map.on('moveend', (event) => {
    if (!event.originalEvent) return;
    const point = map.unproject(focusPoint());
    post({type:'pickup',lat:point.lat,lng:point.lng});
  });
} catch (_) { post({type:'error'}); }
</script></body></html>`;
}

export const LocationMap = forwardRef<LocationMapHandle, Props>(function LocationMap(
  { initial, onCenterChange, onReady, locked }, ref,
) {
  const web = useRef<MapWebViewHandle>(null);
  const [source] = useState(() => ({ html: makeHtml(initial) }));
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    goTo({ lng, lat }, zoom = 16) {
      web.current?.injectJavaScript(
        `window.goTo?.(${JSON.stringify([lng, lat])}, ${JSON.stringify(zoom)}); true;`,
      );
    },
    setSheetCover(bottomPadRatio, focusYRatio) {
      web.current?.injectJavaScript(
        `window.setSheetCover?.(${JSON.stringify(bottomPadRatio)}, ${JSON.stringify(focusYRatio)}); true;`,
      );
    },
  }), []);

  return (
    <View style={styles.container} pointerEvents={locked ? 'none' : 'auto'}>
      <WebView
        ref={web}
        source={source}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={({ url }) => url === 'about:blank' || url.startsWith('data:text/html')}
        applicationNameForUserAgent="ManaPrayanam/1.0"
        scrollEnabled={false}
        onError={() => setFailed(true)}
        onMessage={({ nativeEvent }) => {
          try {
            const message = JSON.parse(nativeEvent.data);
            if (message.type === 'ready') onReady?.();
            if (message.type === 'error') setFailed(true);
            if (message.type === 'idle') setFailed(false);
            if (message.type === 'pickup' && Number.isFinite(message.lat) && Number.isFinite(message.lng)) {
              onCenterChange({ lat: message.lat, lng: message.lng });
            }
          } catch {
            // Ignore messages outside the map protocol.
          }
        }}
      />
      {failed && <Text accessibilityRole="alert" style={styles.error}>Map unavailable. Check your connection.</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, backgroundColor: '#D5DDD9' },
  error: { position: 'absolute', top: '38%', alignSelf: 'center', backgroundColor: '#fff', padding: 8 },
});
