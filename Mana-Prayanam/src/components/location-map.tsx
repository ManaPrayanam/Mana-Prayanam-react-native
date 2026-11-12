import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, type ComponentType, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import WebViewDefault, { type WebViewMessageEvent } from 'react-native-webview';
import { color, spacing } from '@/theme/brand';

type WebViewLike = {
  injectJavaScript: (script: string) => void;
};

type WebViewComponentProps = {
  ref?: Ref<WebViewLike>;
  originWhitelist?: string[];
  source: { html: string };
  onMessage: (event: WebViewMessageEvent) => void;
  style?: StyleProp<ViewStyle>;
  javaScriptEnabled?: boolean;
  domStorageEnabled?: boolean;
  scrollEnabled?: boolean;
  overScrollMode?: 'never' | 'always' | 'content';
  setSupportMultipleWindows?: boolean;
  mixedContentMode?: 'always' | 'never' | 'compatibility';
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
};

const WebView = WebViewDefault as unknown as ComponentType<WebViewComponentProps>;

export type MapCoords = { lat: number; lng: number };

export type LocationMapHandle = {
  goTo: (coords: MapCoords, zoom?: number) => void;
};

type Props = {
  initial: MapCoords;
  onCenterChange: (coords: MapCoords) => void;
  onMyLocation?: () => void;
  showMyLocationButton?: boolean;
  /** Vertical pin position in the map (0–1). Use mid-point of the visible map above the sheet. */
  pinYRatio?: number;
  /** Freeze map interaction / size changes (e.g. while keyboard is open). */
  locked?: boolean;
  style?: StyleProp<ViewStyle>;
};

function leafletHtml(initial: MapCoords, pinYRatio: number) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; height: 100%; width: 100%; background: #e8efec; }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var PIN_Y = ${pinYRatio};
    var map = L.map('map', { zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ''
    }).addTo(map);

    function pinLatLng() {
      var size = map.getSize();
      return map.containerPointToLatLng(L.point(size.x / 2, size.y * PIN_Y));
    }

    // Place lat/lng exactly under the pin (no stacked panBy drift)
    function placeAtPin(lat, lng, zoom) {
      zoom = zoom || 17;
      var size = map.getSize();
      if (!size.x || !size.y) {
        map.setView([lat, lng], zoom, { animate: false });
        return;
      }
      var targetPoint = L.point(size.x / 2, size.y * PIN_Y);
      var projected = map.project([lat, lng], zoom);
      var centerPoint = projected.subtract(targetPoint).add(size.divideBy(2));
      var center = map.unproject(centerPoint, zoom);
      map.setView(center, zoom, { animate: false });
    }

    map.whenReady(function () {
      placeAtPin(${initial.lat}, ${initial.lng}, 17);
      setTimeout(function () { placeAtPin(${initial.lat}, ${initial.lng}, 17); postCenter(); }, 50);
    });

    function postCenter() {
      var c = pinLatLng();
      var payload = JSON.stringify({ type: 'center', lat: c.lat, lng: c.lng });
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
    }
    map.on('moveend', postCenter);

    function onMessage(raw) {
      try {
        var msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (msg && msg.type === 'setCenter' && typeof msg.lat === 'number' && typeof msg.lng === 'number') {
          placeAtPin(msg.lat, msg.lng, msg.zoom || map.getZoom());
        }
      } catch (e) {}
    }
    document.addEventListener('message', function (e) { onMessage(e.data); });
    window.addEventListener('message', function (e) { onMessage(e.data); });
  </script>
</body>
</html>`;
}

export const LocationMap = forwardRef<LocationMapHandle, Props>(function LocationMap(
  {
    initial,
    onCenterChange,
    onMyLocation,
    showMyLocationButton = true,
    pinYRatio = 0.5,
    locked = false,
    style,
  },
  ref,
) {
  const webRef = useRef<WebViewLike>(null);
  const html = useMemo(
    () => leafletHtml(initial, pinYRatio),
    [initial.lat, initial.lng, pinYRatio],
  );

  const goTo = useCallback((coords: MapCoords, zoom = 17) => {
    const payload = JSON.stringify({
      type: 'setCenter', lat: coords.lat, lng: coords.lng, zoom,
    });
    webRef.current?.injectJavaScript(
      `(function(){try{var msg=${payload};if(msg&&msg.type==='setCenter'){placeAtPin(msg.lat,msg.lng,msg.zoom||map.getZoom());}}catch(e){} true;})();`,
    );
  }, []);

  useImperativeHandle(ref, () => ({ goTo }), [goTo]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; lat?: number; lng?: number };
      if (data.type === 'center' && typeof data.lat === 'number' && typeof data.lng === 'number') {
        onCenterChange({ lat: data.lat, lng: data.lng });
      }
    } catch {
      // ignore
    }
  }, [onCenterChange]);

  return (
    <View style={[styles.wrap, style]} pointerEvents={locked ? 'none' : 'auto'}>
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        overScrollMode="never"
        setSupportMultipleWindows={false}
        mixedContentMode="always"
        pointerEvents={locked ? 'none' : 'auto'}
      />
      <View pointerEvents="none" style={styles.pinWrap}>
        <View style={[styles.pinAnchor, { top: `${pinYRatio * 100}%` }]}>
          <View style={styles.youBubble}>
            <Ionicons name="person" size={12} color={color.surface} />
            <Text style={styles.youLabel}>You</Text>
          </View>
          <View style={styles.pinDot} />
          <View style={styles.pinStem} />
        </View>
      </View>
      {showMyLocationButton && onMyLocation ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="My location"
          onPress={onMyLocation}
          style={({ pressed }) => [styles.locBtn, pressed && styles.dim]}
        >
          <Ionicons name="locate" size={22} color={color.brand} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: color.tint,
  },
  map: { flex: 1, backgroundColor: color.tint },
  pinWrap: {
    ...StyleSheet.absoluteFill,
  },
  pinAnchor: {
    position: 'absolute',
    left: '50%',
    marginLeft: -22,
    alignItems: 'center',
    transform: [{ translateY: -40 }],
  },
  youBubble: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  youLabel: {
    color: color.surface,
    fontSize: 12,
    fontWeight: '700',
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: color.brand,
    borderWidth: 2,
    borderColor: color.surface,
  },
  pinStem: {
    width: 2,
    height: 10,
    backgroundColor: color.brand,
    marginTop: -1,
  },
  locBtn: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.7 },
});
