import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type Ref,
} from 'react';
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

export type RouteMapHandle = {
  goToPickup: () => void;
  resetNorth: () => void;
  fitRoute: () => void;
  startSearchRadar: () => void;
  stopSearchRadar: () => void;
  showApproachingDriver: (
    coords: MapCoords,
    etaMin?: number,
    distKm?: number,
    vehicleKind?: 'bike' | 'auto',
  ) => void;
};

type Props = {
  pickup: MapCoords;
  drop: MapCoords;
  route: [number, number][];
  nearby: Array<{ lat: number; lng: number; bearing?: number }>;
  vehicle: 'bike' | 'auto';
  pickupLabel: string;
  dropLabel: string;
  bottomPadRatio?: number;
  onEditPickup?: () => void;
  onEditDrop?: () => void;
  onApproachEta?: (mins: number | null) => void;
};

function makeHtml(
  pickup: MapCoords,
  drop: MapCoords,
  route: [number, number][],
  nearby: Array<{ lat: number; lng: number; bearing?: number }>,
  bikeIcon: string,
  autoIcon: string,
  initialVehicle: 'bike' | 'auto',
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
.pin{
  width:28px;height:40px;position:relative;
  filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));
}
.pin svg{display:block;width:28px;height:40px}
.pickup-dot{
  width:22px;height:22px;border-radius:50%;
  background:#159447;border:3px solid #fff;
  box-shadow:0 1px 5px rgba(0,0,0,.35);
  position:relative;
}
.pickup-dot:after{
  content:'';position:absolute;left:50%;top:50%;
  width:7px;height:7px;margin:-3.5px 0 0 -3.5px;
  border-radius:50%;background:#111;
}
.tag{
  display:flex;align-items:center;gap:6px;
  background:#fff;border-radius:16px;padding:7px 10px 7px 12px;
  font:600 12px -apple-system,BlinkMacSystemFont,sans-serif;color:#111827;
  box-shadow:0 2px 8px rgba(0,0,0,.18);max-width:168px;cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}
.tag span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}
.tag .edit{
  width:18px;height:18px;border-radius:9px;background:#F3F4F6;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.tag .edit svg{width:11px;height:11px}
.fleet-wrap{width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:transparent}
.fleet{width:30px;height:30px;object-fit:contain;background:transparent;border:0;border-radius:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.driver-wrap{
  width:58px;height:58px;border-radius:29px;background:#fff;
  border:3px solid #159447;display:flex;align-items:center;justify-content:center;
  box-shadow:0 3px 10px rgba(0,0,0,.35);
}
.driver-wrap img{width:42px;height:42px;object-fit:contain;display:block}
.radar-wrap{width:160px;height:160px;position:relative;pointer-events:none}
.radar-ring{
  position:absolute;left:50%;top:50%;width:100%;height:100%;box-sizing:border-box;
  border:2.5px solid rgba(21,148,71,.85);border-radius:50%;
  transform:translate(-50%,-50%) scale(0.15);opacity:0.75;
  animation:radarPulse 2.1s ease-out infinite;
}
.radar-ring.r2{animation-delay:.7s}
.radar-ring.r3{animation-delay:1.4s}
@keyframes radarPulse{
  0%{transform:translate(-50%,-50%) scale(0.15);opacity:.75}
  100%{transform:translate(-50%,-50%) scale(1);opacity:0}
}
.eta-pill{
  background:#159447;color:#fff;border-radius:16px;padding:7px 12px;
  font:700 12px -apple-system,BlinkMacSystemFont,sans-serif;
  box-shadow:0 2px 8px rgba(0,0,0,.2);white-space:nowrap;
}
</style>
</head><body><div id="map"></div>
<script>
const post = (payload) => window.ReactNativeWebView.postMessage(JSON.stringify(payload));
const pickup = ${JSON.stringify([pickup.lng, pickup.lat])};
const drop = ${JSON.stringify([drop.lng, drop.lat])};
const route = ${JSON.stringify(line)};
const nearby = ${JSON.stringify(nearby)};
const icons = { bike: ${JSON.stringify(bikeIcon)}, auto: ${JSON.stringify(autoIcon)} };
let currentVehicle = ${JSON.stringify(initialVehicle)};
const pickupLabel = ${JSON.stringify(pickupLabel)};
const dropLabel = ${JSON.stringify(dropLabel)};
const bottomPad = ${JSON.stringify(bottomPadRatio)};
const fleetImgs = [];

function shortLabel(text) {
  const t = String(text || '');
  return t.length > 18 ? t.slice(0, 17) + '…' : t;
}

function pinEl(color) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.innerHTML = '<svg viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z" fill="'+color+'"/><circle cx="14" cy="14" r="5.5" fill="#fff"/></svg>';
  return el;
}

function tagEl(text, kind) {
  const el = document.createElement('div');
  el.className = 'tag';
  el.innerHTML = '<span></span><div class="edit"><svg viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>';
  el.querySelector('span').textContent = shortLabel(text);
  el.addEventListener('click', function(e) {
    e.stopPropagation();
    post({ type: kind === 'pickup' ? 'editPickup' : 'editDrop' });
  });
  return el;
}

try {
  const map = new maplibregl.Map({
    container:'map',
    center: pickup,
    zoom: 14,
    maxZoom: 18,
    dragRotate: true,
    pitchWithRotate: false,
    style: { version: 8, sources: { streets: { type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap' } },
      layers: [{ id: 'streets', type: 'raster', source: 'streets' }] }
  });

  /**
   * Road-snapped nearby fleet. Marker art faces RIGHT (east), so CSS rotate
   * is geographicBearing - 90. Keep upright (no upside-down flips).
   */
  function fleetFromNearby() {
    if (!nearby || !nearby.length) return [];
    return nearby.map((v, i) => {
      let bearing = typeof v.bearing === 'number' ? v.bearing : (i * 45);
      bearing = ((bearing % 360) + 360) % 360;
      // Don't show the icon upside-down on screen — flip 180 if needed
      if (bearing > 90 && bearing < 270) bearing = (bearing + 180) % 360;
      const angle = bearing - 90; // art faces east
      return { lng: v.lng, lat: v.lat, angle };
    });
  }

  /** Zoom tight around pickup + nearby fleet — not the full trip. */
  function fitPickupArea(fleetPts) {
    const bounds = new maplibregl.LngLatBounds(pickup, pickup);
    (fleetPts || []).forEach((p) => bounds.extend([p.lng, p.lat]));
    const pad = 0.0005;
    bounds.extend([pickup[0] - pad, pickup[1] - pad]);
    bounds.extend([pickup[0] + pad, pickup[1] + pad]);
    map.fitBounds(bounds, {
      padding: visiblePad(),
      maxZoom: 17.4,
      duration: 450,
    });
  }

  function visiblePad() {
    const h = map.getContainer().clientHeight;
    return {
      top: 56,
      left: 36,
      right: 44,
      // Keep center in the visible map ABOVE the sheet (not under it)
      bottom: Math.round(h * bottomPad) + 24,
    };
  }

  window.goToPickup = function() {
    map.easeTo({
      center: pickup,
      zoom: 17,
      padding: visiblePad(),
      duration: 450,
    });
  };
  window.resetNorth = function() {
    map.easeTo({ bearing: 0, duration: 350 });
  };
  window.fitRoute = function() { fitPickupArea(); };
  const fleetMarkers = [];
  let radarMarker = null;
  let driverMarker = null;
  let driverImgEl = null;
  let etaMarker = null;
  let approachTimer = null;

  window.setVehicleIcon = function(kind) {
    currentVehicle = kind === 'auto' ? 'auto' : 'bike';
    const src = icons[currentVehicle];
    fleetImgs.forEach((img) => { img.src = src; });
    if (driverImgEl) driverImgEl.src = src;
  };
  let pickDotMarker = null;
  let dropPinMarker = null;
  let pickupTagMarker = null;
  let dropTagMarker = null;

  function setTripRouteVisible(on) {
    try {
      if (map.getLayer('route-line')) map.setLayoutProperty('route-line', 'visibility', on ? 'visible' : 'none');
      if (map.getLayer('route-glow')) map.setLayoutProperty('route-glow', 'visibility', on ? 'visible' : 'none');
      if (map.getLayer('approach-line')) map.setLayoutProperty('approach-line', 'visibility', on ? 'none' : 'visible');
    } catch (_) {}
  }

  window.clearFleet = function() {
    while (fleetMarkers.length) {
      const m = fleetMarkers.pop();
      try { m.remove(); } catch (_) {}
    }
    fleetImgs.length = 0;
  };

  window.startSearchRadar = function() {
    window.clearFleet();
    // Hide trip route + drop pin so only pickup + radar rings show (no extra green pins)
    setTripRouteVisible(false);
    if (dropPinMarker) dropPinMarker.getElement().style.display = 'none';
    if (dropTagMarker) dropTagMarker.getElement().style.display = 'none';
    if (pickupTagMarker) pickupTagMarker.getElement().style.display = 'none';
    if (radarMarker) return;
    const el = document.createElement('div');
    el.className = 'radar-wrap';
    // Rings only — reuse existing pickup green dot as the center (no second green pin)
    el.innerHTML = '<div class="radar-ring"></div><div class="radar-ring r2"></div><div class="radar-ring r3"></div>';
    radarMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(pickup).addTo(map);
    map.easeTo({
      center: pickup,
      zoom: 16.5,
      padding: visiblePad(),
      duration: 500,
    });
  };

  window.stopSearchRadar = function() {
    if (radarMarker) {
      try { radarMarker.remove(); } catch (_) {}
      radarMarker = null;
    }
  };

  function bearingDeg(a, b) {
    return Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI;
  }

  /** Fleet art faces UP in the PNG → CSS rotate = geographic bearing. */
  function faceAlong(img, from, to) {
    let angle = bearingDeg(from, to);
    angle = ((angle % 360) + 360) % 360;
    img.style.transform = 'rotate(' + angle + 'deg)';
  }

  function approachPad() {
    const h = map.getContainer().clientHeight || 600;
    // Keep padding small enough that fitBounds can still show the vehicle
    return {
      top: 70,
      left: 36,
      right: 36,
      bottom: Math.min(Math.round(h * 0.42), h - 220),
    };
  }

  function fitDriverAndPickup(a, b) {
    const bounds = new maplibregl.LngLatBounds(a, a);
    bounds.extend(b);
    try {
      map.fitBounds(bounds, { padding: approachPad(), maxZoom: 13.2, duration: 700 });
    } catch (_) {
      try {
        map.fitBounds(bounds, { padding: 48, maxZoom: 12.5, duration: 700 });
      } catch (__) {}
    }
  }

  function runApproachAlongPath(path, mins, vehicleKind) {
    if (!path || path.length < 2) return;
    if (approachTimer) { clearInterval(approachTimer); approachTimer = null; }
    if (vehicleKind === 'auto' || vehicleKind === 'bike') {
      currentVehicle = vehicleKind;
    }

    // Draw the approach path (driver → pickup) in green
    if (map.getSource('approach')) {
      map.getSource('approach').setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: path },
      });
    } else {
      map.addSource('approach', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: path },
        },
      });
      map.addLayer({
        id: 'approach-line',
        type: 'line',
        source: 'approach',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#159447', 'line-width': 5, 'line-opacity': 0.95 },
      });
    }

    const start = path[0];
    const end = path[path.length - 1];
    const wrap = document.createElement('div');
    wrap.className = 'driver-wrap';
    const img = document.createElement('img');
    img.alt = currentVehicle === 'auto' ? 'Auto' : 'Bike';
    img.src = icons[currentVehicle] || icons.bike;
    img.onerror = function() {
      // Fallback glyph if PNG fails to decode in WebView
      wrap.textContent = currentVehicle === 'auto' ? '🛺' : '🛵';
      wrap.style.fontSize = '28px';
    };
    wrap.appendChild(img);
    driverImgEl = img;
    if (driverMarker) {
      try { driverMarker.remove(); } catch (_) {}
      driverMarker = null;
    }
    if (etaMarker) {
      try { etaMarker.remove(); } catch (_) {}
      etaMarker = null;
    }
    faceAlong(img, path[0], path[Math.min(1, path.length - 1)]);
    driverMarker = new maplibregl.Marker({ element: wrap, anchor: 'center' })
      .setLngLat(start)
      .setOffset([0, 0])
      .addTo(map);

    const startMins = Math.max(1, Math.round(mins) || 8);
    const tag = document.createElement('div');
    tag.className = 'eta-pill';
    tag.textContent = startMins + ' mins away';
    etaMarker = new maplibregl.Marker({ element: tag, offset: [0, -52], anchor: 'bottom' })
      .setLngLat(start)
      .addTo(map);
    post({ type: 'approachEta', mins: startMins, arrived: false });

    // Zoom out FIRST so the assigned vehicle is on screen with pickup
    fitDriverAndPickup(start, end);
    setTimeout(function() { fitDriverAndPickup(start, end); }, 350);
    setTimeout(function() { fitDriverAndPickup(start, end); }, 900);

    // Time-based move so ETA counts down smoothly and arrival always fires
    const total = path.length - 1;
    const durationMs = 22000;
    const tickMs = 250;
    const startedAt = Date.now();
    let lastPosted = startMins;
    let finished = false;
    let lastCam = 0;

    approachTimer = setInterval(function() {
      if (finished) return;
      const elapsed = Date.now() - startedAt;
      const t = Math.min(1, elapsed / durationMs);
      const idx = Math.min(total, Math.floor(t * total));
      const cur = path[idx];
      const prev = path[Math.max(0, idx - 1)];
      faceAlong(img, prev, cur);
      if (driverMarker) driverMarker.setLngLat(cur);

      // Keep vehicle + pickup framed while approaching
      if (elapsed - lastCam > 2800 && t < 0.9) {
        lastCam = elapsed;
        fitDriverAndPickup(cur, end);
      }

      const remainMin = Math.max(1, Math.ceil(startMins * (1 - t)));
      if (t < 0.94) {
        if (etaMarker) {
          try {
            etaMarker.setLngLat(cur);
            tag.textContent = remainMin + ' mins away';
          } catch (_) {}
        }
        if (remainMin !== lastPosted) {
          lastPosted = remainMin;
          post({ type: 'approachEta', mins: remainMin, arrived: false });
        }
        return;
      }

      // At pickup
      finished = true;
      if (driverMarker) driverMarker.setLngLat(path[total]);
      if (etaMarker) {
        try { etaMarker.remove(); } catch (_) {}
        etaMarker = null;
      }
      try {
        map.easeTo({ center: path[total], zoom: Math.min(map.getZoom(), 15.5), padding: approachPad(), duration: 600 });
      } catch (_) {}
      post({ type: 'approachEta', mins: 0, arrived: true });
      clearInterval(approachTimer);
      approachTimer = null;
    }, tickMs);
  }

  window.showApproachingDriver = function(lat, lng, etaMin, _distKm, vehicleKind) {
    window.stopSearchRadar();
    window.clearFleet();
    setTripRouteVisible(false);
    if (dropPinMarker) dropPinMarker.getElement().style.display = 'none';
    if (dropTagMarker) dropTagMarker.getElement().style.display = 'none';
    if (pickupTagMarker) pickupTagMarker.getElement().style.display = 'none';
    // Keep pickup dot visible so the destination of the approach is clear
    if (pickDotMarker) pickDotMarker.getElement().style.display = '';

    const mins = etaMin || 8;
    const kind = (vehicleKind === 'auto' || vehicleKind === 'bike')
      ? vehicleKind
      : currentVehicle;
    currentVehicle = kind;

    // Immediately put a temporary marker at the assigned spot so something is visible
    // while OSRM loads the road path
    const tempStart = [lng, lat];
    runApproachAlongPath([tempStart, pickup.slice()], mins, kind);

    const url = 'https://router.project-osrm.org/route/v1/driving/'
      + lng + ',' + lat + ';' + pickup[0] + ',' + pickup[1]
      + '?overview=full&geometries=geojson';

    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        const coords = data && data.routes && data.routes[0] && data.routes[0].geometry
          && data.routes[0].geometry.coordinates;
        if (coords && coords.length >= 2) {
          runApproachAlongPath(coords, mins, kind);
        }
      })
      .catch(function() {});
  };

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

    // Rapido-style green circle at pickup
    const pickDot = document.createElement('div');
    pickDot.className = 'pickup-dot';
    pickDotMarker = new maplibregl.Marker({ element: pickDot, anchor: 'center' })
      .setLngLat(pickup).addTo(map);

    dropPinMarker = new maplibregl.Marker({ element: pinEl('#E53935'), anchor: 'bottom' })
      .setLngLat(drop).addTo(map);

    if (pickupLabel) {
      pickupTagMarker = new maplibregl.Marker({
        element: tagEl(pickupLabel, 'pickup'),
        offset: [0, -28],
        anchor: 'bottom',
      }).setLngLat(pickup).addTo(map);
    }
    if (dropLabel) {
      dropTagMarker = new maplibregl.Marker({
        element: tagEl(dropLabel, 'drop'),
        offset: [0, -28],
        anchor: 'bottom',
      }).setLngLat(drop).addTo(map);
    }

    const fleet = fleetFromNearby();
    fleet.forEach((spot) => {
      const wrap = document.createElement('div');
      wrap.className = 'fleet-wrap';
      const img = document.createElement('img');
      img.className = 'fleet';
      img.src = icons[currentVehicle];
      img.style.transform = 'rotate(' + spot.angle + 'deg)';
      wrap.appendChild(img);
      fleetImgs.push(img);
      const marker = new maplibregl.Marker({ element: wrap, anchor: 'center' })
        .setLngLat([spot.lng, spot.lat]).addTo(map);
      fleetMarkers.push(marker);
    });

    fitPickupArea(fleet);
    post({ type: 'ready' });
  });
  map.on('error', () => post({ type: 'error' }));
} catch (_) { post({ type: 'error' }); }
</script></body></html>`;
}

export const RouteMap = forwardRef<RouteMapHandle, Props>(function RouteMap(
  {
    pickup,
    drop,
    route,
    nearby,
    vehicle,
    pickupLabel,
    dropLabel,
    bottomPadRatio = 0.5,
    onEditPickup,
    onEditDrop,
    onApproachEta,
  },
  ref,
) {
  const web = useRef<MapWebViewHandle>(null);
  const etaCb = useRef(onApproachEta);
  etaCb.current = onApproachEta;
  const [failed, setFailed] = useState(false);
  const source = useMemo(
    () => ({
      html: makeHtml(
        pickup,
        drop,
        route,
        nearby,
        BIKE_MARKER_DATA_URI,
        AUTO_MARKER_DATA_URI,
        vehicle,
        pickupLabel,
        dropLabel,
        bottomPadRatio,
      ),
    }),
    // Intentionally omit `vehicle` — icon swaps via injectJS (no map flicker).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickup, drop, route, nearby, pickupLabel, dropLabel, bottomPadRatio],
  );

  useEffect(() => {
    web.current?.injectJavaScript(
      `window.setVehicleIcon?.(${JSON.stringify(vehicle)}); true;`,
    );
  }, [vehicle]);

  useImperativeHandle(ref, () => ({
    goToPickup() {
      web.current?.injectJavaScript('window.goToPickup?.(); true;');
    },
    resetNorth() {
      web.current?.injectJavaScript('window.resetNorth?.(); true;');
    },
    fitRoute() {
      web.current?.injectJavaScript('window.fitRoute?.(); true;');
    },
    startSearchRadar() {
      web.current?.injectJavaScript('window.startSearchRadar?.(); true;');
    },
    stopSearchRadar() {
      web.current?.injectJavaScript('window.stopSearchRadar?.(); true;');
    },
    showApproachingDriver(coords, etaMin = 8, distKm = 2.5, vehicleKind?: 'bike' | 'auto') {
      const kind = vehicleKind === 'auto' ? 'auto' : 'bike';
      web.current?.injectJavaScript(
        `window.showApproachingDriver?.({{LAT}}, {{LNG}}, {{ETA}}, {{KM}}, {{KIND}}); true;`
          .replace('{{LAT}}', String(coords.lat))
          .replace('{{LNG}}', String(coords.lng))
          .replace('{{ETA}}', String(etaMin))
          .replace('{{KM}}', String(distKm))
          .replace('{{KIND}}', JSON.stringify(kind)),
      );
    },
  }));

  const mapKey = `${pickup.lat},${pickup.lng},${drop.lat},${drop.lng},${nearby.length}`;

  return (
    <View style={styles.container}>
      <WebView
        ref={web}
        key={mapKey}
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
            if (message.type === 'ready') {
              setFailed(false);
              web.current?.injectJavaScript(
                `window.setVehicleIcon?.(${JSON.stringify(vehicle)}); true;`,
              );
            }
            if (message.type === 'editPickup') onEditPickup?.();
            if (message.type === 'editDrop') onEditDrop?.();
            if (message.type === 'approachEta') {
              // Only treat as arrived when map says arrived:true (at pickup)
              const mins =
                message.arrived === true
                  ? 0
                  : typeof message.mins === 'number'
                    ? Math.max(1, message.mins)
                    : null;
              etaCb.current?.(mins);
            }
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
});

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
