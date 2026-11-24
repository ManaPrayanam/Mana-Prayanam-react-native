import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { reverseGeocode, type MapCoords } from '@/api/geocode';
import { LocationMap, type LocationMapHandle } from '@/components/location-map';
import { MapBottomSheet } from '@/components/map-bottom-sheet';
import {
  clearRideDraft,
  getRideDestination,
  setRideDestination,
  setRideDraft,
  subscribeRideDestination,
  type RideVehicle,
} from '@/location/ride-draft';
import { color, radius, spacing } from '@/theme/brand';
import { peekLocation, warmLocation } from '@/location/warm-location';
import { log } from '@/utils/log';

const MOVE_THRESHOLD_M = 25;
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const SHEET_MID_H = Math.round(SCREEN_H * 0.68);
const FAB_GAP = 22;
const PROMO_W = SCREEN_W - spacing.md * 2;
/** Snap cover ratios: bottom pad + focus Y (mid of visible map) */
const SHEET_COVER = [
  { pad: 0.48, focus: 0.24 },
  { pad: 0.68, focus: 0.16 },
  { pad: 0.9, focus: 0.05 },
] as const;
/** 16:9 so banner text isn’t cropped by cover */
const PROMO_H = Math.round(PROMO_W * (9 / 16));
const PROMO_AUTO_MS = 3500;

const PROMOS = [
  {
    source: require('@/assets/images/promo-bike-clear.jpg'),
    label: 'Mana Prayanam bike deal. Short trips flat fare. Ride now.',
  },
  {
    source: require('@/assets/images/promo-auto-evening.jpg'),
    label: 'Mana Prayanam evening auto. Extra room for family trips. Book auto.',
  },
  {
    source: require('@/assets/images/promo-weekend-rides.jpg'),
    label: 'Mana Prayanam weekend rides. Rain or shine. Book now.',
  },
] as const;

const PAST_RIDES = [
  {
    id: 'past-1',
    title: 'Indiranagar 100 Feet Rd',
    address: '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru',
  },
  {
    id: 'past-2',
    title: 'HSR Layout Sector 2',
    address: '27th Main Rd, Sector 2, HSR Layout, Bengaluru',
  },
] as const;

function distanceMeters(a: MapCoords, b: MapCoords) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function RequestScreen() {
  const focused = useIsFocused();
  const mapRef = useRef<LocationMapHandle>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressRequest = useRef(0);
  const followGps = useRef(true);
  const lastGps = useRef<MapCoords | null>(null);
  const applyingGpsMove = useRef(false);
  const editingDestination = useRef(false);

  const [gpsOrigin, setGpsOrigin] = useState<MapCoords | null>(() => peekLocation());
  const [locating, setLocating] = useState(true);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState(() => getRideDestination());
  /** No default — user must tap Auto or Bike. */
  const [service, setService] = useState<RideVehicle | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [locationHint, setLocationHint] = useState('');
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [promoIndex, setPromoIndex] = useState(0);
  const promoScrollRef = useRef<{ scrollTo: (o: { x: number; animated?: boolean }) => void } | null>(null);
  const promoIndexRef = useRef(0);
  const sheetPosition = useSharedValue(SCREEN_H - SHEET_MID_H);
  const pageHeight = useSharedValue(SCREEN_H);
  const pageLaidOut = useRef(false);

  const onPageLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    // Lock first stable height — ignore keyboard shrink/expand (that bounced the sheet).
    if (!pageLaidOut.current && h > 0) {
      pageLaidOut.current = true;
      pageHeight.value = h;
      return;
    }
    if (h > pageHeight.value) {
      pageHeight.value = h;
    }
  }, [pageHeight]);

  const fabStyle = useAnimatedStyle(() => {
    const bottom = pageHeight.value - sheetPosition.value + FAB_GAP;
    return { bottom: bottom > FAB_GAP ? bottom : FAB_GAP };
  });

  const syncMapCover = useCallback((_index?: number) => {
    // Keep map focus on the fixed pin (mid snap). Avoid jumping camera on every snap.
    const cover = SHEET_COVER[1];
    mapRef.current?.setSheetCover(cover.pad, cover.focus);
  }, []);

  useEffect(() => {
    return subscribeRideDestination(() => {
      setDestination(getRideDestination());
      editingDestination.current = false;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setDestination(getRideDestination());
      editingDestination.current = false;
      // Never pre-select Auto/Bike — user picks each time.
      setService(null);
      // Sheet remounts at mid snap — keep My location visible.
      setSheetExpanded(false);
      sheetPosition.value = SCREEN_H - SHEET_MID_H;
    }, [sheetPosition]),
  );

  useEffect(() => {
    const tick = setInterval(() => {
      const next = (promoIndexRef.current + 1) % PROMOS.length;
      promoIndexRef.current = next;
      setPromoIndex(next);
      promoScrollRef.current?.scrollTo({ x: next * PROMO_W, animated: true });
    }, PROMO_AUTO_MS);
    return () => clearInterval(tick);
  }, []);

  const onPromoScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / PROMO_W);
    const clamped = Math.max(0, Math.min(PROMOS.length - 1, next));
    promoIndexRef.current = clamped;
    setPromoIndex(clamped);
  }, []);

  const lookupAddress = useCallback((next: MapCoords) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    const request = ++addressRequest.current;
    setGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const address = await reverseGeocode(next);
        if (request !== addressRequest.current) return;
        setPickup(address);
        setLocationHint('');
      } catch {
        if (request !== addressRequest.current) return;
        setPickup(`${next.lat.toFixed(5)}, ${next.lng.toFixed(5)}`);
        setLocationHint('Address lookup failed — you can still request with coordinates.');
      } finally {
        if (request === addressRequest.current) setGeocoding(false);
      }
    }, 500);
  }, []);

  const mapMounted = useRef(false);

  const applyGps = useCallback((next: MapCoords, recenter: boolean) => {
    lastGps.current = next;
    // Keep map `initial` stable — only seed once so LocationMap does not remount/loop
    setGpsOrigin((prev) => {
      if (prev && distanceMeters(prev, next) < 1) return prev;
      // After first paint, prefer goTo over changing the prop
      if (mapMounted.current) return prev;
      return next;
    });
    setLocating(false);
    setLocationHint('');
    if (mapMounted.current && recenter && followGps.current && !editingDestination.current) {
      applyingGpsMove.current = true;
      mapRef.current?.goTo(next, 16);
      setTimeout(() => { applyingGpsMove.current = false; }, 500);
    }
    lookupAddress(next);
  }, [lookupAddress]);

  const onCenterChange = useCallback((next: MapCoords) => {
    if (applyingGpsMove.current) return;
    lookupAddress(next);
    const gps = lastGps.current;
    if (gps && distanceMeters(gps, next) > MOVE_THRESHOLD_M) {
      followGps.current = false;
    }
  }, [lookupAddress]);

  const onMapReady = useCallback(() => {
    log('Map', 'map ready');
    mapMounted.current = true;
    syncMapCover(1);
    const target = lastGps.current ?? peekLocation();
    if (target) {
      applyingGpsMove.current = true;
      mapRef.current?.goTo(target, 16);
      setTimeout(() => { applyingGpsMove.current = false; }, 500);
    }
  }, [syncMapCover]);

  const goMyLocation = useCallback(async () => {
    log('Map', 'My location pressed', { hasCached: Boolean(lastGps.current) });
    followGps.current = true;
    setLocationHint('');

    if (lastGps.current) {
      applyingGpsMove.current = true;
      mapRef.current?.goTo(lastGps.current, 16);
      setTimeout(() => {
        applyingGpsMove.current = false;
      }, 80);
      lookupAddress(lastGps.current);
      setLocating(false);
      return;
    }

    setLocating(true);
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const permission = status === 'granted'
        ? { status }
        : await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationHint('Location permission is required.');
        return;
      }

      const cached = await Location.getLastKnownPositionAsync({
        maxAge: 120_000,
        requiredAccuracy: 500,
      });
      if (cached) {
        applyGps(
          { lat: cached.coords.latitude, lng: cached.coords.longitude },
          true,
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Lowest,
      });
      applyGps(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        true,
      );
    } catch {
      setLocationHint('Could not read your current location.');
    } finally {
      setLocating(false);
    }
  }, [applyGps, lookupAddress]);

  const openDropLocation = useCallback((vehicle?: RideVehicle) => {
    if (vehicle) {
      setService(vehicle);
      setRideDraft({ vehicle });
    }
    editingDestination.current = true;
    router.push({
      pathname: '/destination',
      params: {
        pickup: pickup || 'Current location',
        destination,
      },
    });
  }, [pickup, destination]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        const known = peekLocation();
        if (known) applyGps(known, true);

        const warmed = await warmLocation();
        if (cancelled) return;
        if (!warmed) {
          setLocating(false);
          setLocationHint('Location permission is required.');
          return;
        }
        log('Map', 'boot GPS');
        applyGps(warmed, true);

        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled || status !== 'granted') return;

        // 3) Keep watching for updates
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: MOVE_THRESHOLD_M,
            timeInterval: 4000,
          },
          (update) => {
            if (cancelled) return;
            const next = {
              lat: update.coords.latitude,
              lng: update.coords.longitude,
            };
            const prev = lastGps.current;
            if (prev && distanceMeters(prev, next) < MOVE_THRESHOLD_M) return;
            applyGps(next, followGps.current);
          },
        );
      } catch {
        if (!cancelled) {
          setLocating(false);
          setLocationHint('Could not read your current location.');
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      addressRequest.current += 1;
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, [applyGps]);

  return (
    <View style={styles.page} onLayout={onPageLayout}>
      <View style={styles.mapLayer} pointerEvents="auto">
        {gpsOrigin ? (
          <LocationMap
            ref={mapRef}
            initial={gpsOrigin}
            onCenterChange={onCenterChange}
            onReady={onMapReady}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.placeholderText} accessibilityLiveRegion="polite">
              {locating ? 'Finding your location…' : locationHint || 'Tap My location to load the map.'}
            </Text>
          </View>
        )}

        <View
          pointerEvents="none"
          style={styles.pickupPinWrap}
          accessible
          accessibilityLabel="Pickup pin"
        >
          <View style={styles.pickupPin}>
            <View style={styles.pickupPinHead}>
              <View style={styles.pickupPinDot} />
            </View>
            <View style={styles.pickupPinPoint} />
          </View>
          <View style={styles.pickupPinShadow} />
        </View>
      </View>

      {!sheetExpanded ? (
        <Animated.View style={[styles.fabWrap, fabStyle]} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My location"
            onPress={() => { void goMyLocation(); }}
            style={({ pressed }) => [styles.fab, pressed && styles.dim]}
          >
            <Ionicons name="locate" size={22} color={color.brand} />
          </Pressable>
        </Animated.View>
      ) : null}

      {focused ? (
      <MapBottomSheet
        contentContainerStyle={styles.sheetContent}
        onExpandedChange={setSheetExpanded}
        animatedPosition={sheetPosition}
      >
        <View style={styles.pastRides}>
          {PAST_RIDES.map((ride, index) => (
            <View
              key={ride.id}
              style={[styles.pastRideRow, index < PAST_RIDES.length - 1 && styles.pastRideDivider]}
            >
              <Ionicons name="time-outline" size={22} color="#6B7280" style={styles.pastRideIcon} />
              <View style={styles.pastRideCopy}>
                <Text style={styles.pastRideTitle} numberOfLines={1}>{ride.title}</Text>
                <Text style={styles.pastRideAddress} numberOfLines={1}>{ride.address}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Reassign ride to ${ride.title}`}
                hitSlop={10}
                onPress={() => {
                  editingDestination.current = true;
                  setRideDestination(ride.title);
                  setDestination(ride.title);
                }}
                style={({ pressed }) => [styles.reassignBtn, pressed && styles.dim]}
              >
                <Ionicons name="refresh" size={22} color="#159447" />
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.pickupRow}>
          <View style={styles.pickupDot} />
          <View style={styles.pickupCopy}>
            <Text style={styles.pickupLabel}>Pickup</Text>
            <Text style={styles.pickupAddress} numberOfLines={2}>
              {geocoding && !pickup
                ? 'Finding address…'
                : pickup || (locating ? 'Getting your location…' : 'Enable location to set pickup')}
            </Text>
            {!!locationHint && <Text style={styles.hint}>{locationHint}</Text>}
          </View>
        </View>

        <View style={styles.whereToRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Where to?"
            onPress={() => openDropLocation()}
            style={({ pressed }) => [styles.whereToBtn, pressed && styles.dim]}
          >
            <Ionicons name="search" size={18} color="#6B7280" />
            <Text
              style={[styles.whereToText, !destination && styles.whereToPlaceholder]}
              numberOfLines={1}
            >
              {destination || 'Where to?'}
            </Text>
          </Pressable>
          {destination ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear destination"
              hitSlop={8}
              onPress={() => {
                editingDestination.current = true;
                clearRideDraft();
                setDestination('');
              }}
              style={({ pressed }) => [styles.whereToClear, pressed && styles.dim]}
            >
              <Ionicons name="close-circle" size={22} color="#9AA0B4" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.services}>
          <Text accessibilityRole="header" style={styles.serviceTitle}>Service</Text>
          <View style={styles.serviceRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Auto"
              accessibilityState={{ selected: service === 'auto' }}
              onPress={() => openDropLocation('auto')}
              style={({ pressed }) => [
                styles.serviceTile,
                service === 'auto' && styles.serviceTileOn,
                pressed && styles.dim,
              ]}
            >
              <View style={[styles.serviceIconBox, service === 'auto' && styles.serviceIconBoxOn]}>
                <Image
                  source={require('@/assets/images/fleet/auto-3d.png')}
                  resizeMode="contain"
                  style={styles.serviceIcon}
                  accessible={false}
                />
              </View>
              <Text style={[styles.serviceLabel, service === 'auto' && styles.serviceLabelOn]}>
                Auto
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bike"
              accessibilityState={{ selected: service === 'bike' }}
              onPress={() => openDropLocation('bike')}
              style={({ pressed }) => [
                styles.serviceTile,
                service === 'bike' && styles.serviceTileOn,
                pressed && styles.dim,
              ]}
            >
              <View style={[styles.serviceIconBox, service === 'bike' && styles.serviceIconBoxOn]}>
                <Image
                  source={require('@/assets/images/fleet/bike-3d.png')}
                  resizeMode="contain"
                  style={styles.serviceIcon}
                  accessible={false}
                />
              </View>
              <Text style={[styles.serviceLabel, service === 'bike' && styles.serviceLabelOn]}>
                Bike
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.promoWrap}>
          <ScrollView
            ref={promoScrollRef as never}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={PROMO_W}
            snapToAlignment="start"
            disableIntervalMomentum
            onMomentumScrollEnd={onPromoScrollEnd}
            style={styles.promoPager}
          >
            {PROMOS.map((promo) => (
              <Image
                key={promo.label}
                accessible
                accessibilityLabel={promo.label}
                source={promo.source}
                resizeMode="cover"
                style={styles.promoBanner}
              />
            ))}
          </ScrollView>
          <View style={styles.promoDots} accessibilityElementsHidden>
            {PROMOS.map((promo, i) => (
              <View
                key={promo.label}
                style={[styles.promoDot, i === promoIndex && styles.promoDotActive]}
              />
            ))}
          </View>
        </View>
      </MapBottomSheet>
      ) : (
        <View style={styles.sheetFreeze} pointerEvents="none" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    // Fixed height so keyboard open/close on destination cannot shrink this layout
    // and bounce the bottom sheet.
    height: SCREEN_H,
    backgroundColor: color.tint,
  },
  sheetFreeze: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_MID_H,
    backgroundColor: color.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    zIndex: 20,
    elevation: 20,
  },
  mapLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.tint,
    zIndex: 1,
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: color.tint,
  },
  placeholderText: {
    color: color.muted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },
  pickupPinWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '16%',
    alignItems: 'center',
    transform: [{ translateY: -40 }],
    zIndex: 2,
  },
  pickupPin: {
    alignItems: 'center',
  },
  pickupPinHead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#159447',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  pickupPinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  pickupPinPoint: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#159447',
  },
  pickupPinShadow: {
    marginTop: 2,
    width: 14,
    height: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  fabWrap: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 25,
    elevation: 25,
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  sheetContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: 24,
  },
  pastRides: {
    marginBottom: 4,
  },
  pastRideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 2,
  },
  pastRideDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  pastRideIcon: {
    marginTop: 1,
  },
  pastRideCopy: {
    flex: 1,
    gap: 3,
  },
  pastRideTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  pastRideAddress: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
  },
  reassignBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: color.brand,
    marginTop: 6,
  },
  pickupCopy: { flex: 1, gap: 2 },
  pickupLabel: { color: '#000000', fontSize: 12, fontWeight: '700' },
  pickupAddress: { color: '#000000', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  hint: { color: color.amber, fontSize: 13, lineHeight: 18 },
  whereToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whereToBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    borderColor: '#159447',
    borderWidth: 1,
    borderRadius: radius.field,
    backgroundColor: color.surface,
  },
  whereToText: {
    flex: 1,
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  whereToPlaceholder: {
    color: '#6B7280',
    fontWeight: '500',
  },
  whereToClear: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  services: { gap: spacing.sm },
  serviceTitle: { color: '#000000', fontSize: 16, fontWeight: '600' },
  serviceRow: { flexDirection: 'row', gap: spacing.sm },
  serviceTile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  serviceTileOn: {
    borderColor: '#159447',
    backgroundColor: '#F0FAF3',
  },
  serviceIconBox: {
    width: '100%',
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  serviceIconBoxOn: {
    borderColor: '#159447',
    backgroundColor: '#FFFFFF',
  },
  serviceIcon: { width: 52, height: 40 },
  serviceLabel: { color: '#000000', fontSize: 14, fontWeight: '700' },
  serviceLabelOn: { color: '#159447' },
  promoWrap: {
    width: '100%',
    gap: 8,
  },
  promoPager: {
    width: PROMO_W,
    borderRadius: 24,
    overflow: 'hidden',
  },
  promoBanner: {
    width: PROMO_W,
    height: PROMO_H,
    borderRadius: 24,
  },
  promoDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  promoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D0D5D2',
  },
  promoDotActive: {
    width: 14,
    backgroundColor: '#159447',
  },
  dim: { opacity: 0.75 },
});
