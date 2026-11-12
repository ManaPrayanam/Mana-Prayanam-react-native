import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { reverseGeocode, type MapCoords } from '@/api/geocode';
import { requestRide } from '@/api/rides';
import { errorMessage } from '@/api/client';
import { useSession } from '@/auth/session';
import { LocationMap, type LocationMapHandle } from '@/components/location-map';
import { MapBottomSheet } from '@/components/map-bottom-sheet';
import { Feedback } from '@/components/ridego-ui';
import { color, radius, spacing } from '@/theme/brand';

const MOVE_THRESHOLD_M = 25;
const WINDOW_H = Dimensions.get('window').height;
const SCREEN_H = Dimensions.get('screen').height;
const SHEET_COLLAPSED = Math.round(WINDOW_H * 0.34);
// Pin sits in the middle of the visible map above the collapsed sheet
const PIN_Y_RATIO = (1 - SHEET_COLLAPSED / WINDOW_H) / 2;

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
  const { authenticated } = useSession();
  const mapRef = useRef<LocationMapHandle>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followGps = useRef(true);
  const lastGps = useRef<MapCoords | null>(null);
  const applyingGpsMove = useRef(false);
  const editingDestination = useRef(false);

  const [gpsOrigin, setGpsOrigin] = useState<MapCoords | null>(null);
  const [locating, setLocating] = useState(true);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [locationHint, setLocationHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const lookupAddress = useCallback((next: MapCoords) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const address = await reverseGeocode(next);
        setPickup(address);
        setLocationHint('');
      } catch {
        setPickup(`${next.lat.toFixed(5)}, ${next.lng.toFixed(5)}`);
        setLocationHint('Address lookup failed — you can still request with coordinates.');
      } finally {
        setGeocoding(false);
      }
    }, 500);
  }, []);

  const applyGps = useCallback((next: MapCoords, recenter: boolean) => {
    lastGps.current = next;
    setGpsOrigin((prev) => prev ?? next);
    setLocating(false);
    setLocationHint('');
    if (recenter && followGps.current && !editingDestination.current) {
      applyingGpsMove.current = true;
      mapRef.current?.goTo(next, 17);
      setTimeout(() => { applyingGpsMove.current = false; }, 400);
    }
    lookupAddress(next);
  }, [lookupAddress]);

  const onCenterChange = useCallback((next: MapCoords) => {
    lookupAddress(next);
    if (applyingGpsMove.current) return;
    const gps = lastGps.current;
    if (gps && distanceMeters(gps, next) > MOVE_THRESHOLD_M) {
      followGps.current = false;
    }
  }, [lookupAddress]);

  const goMyLocation = useCallback(async () => {
    followGps.current = true;
    setLocationHint('');

    if (lastGps.current) {
      applyGps(lastGps.current, true);
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
        setGpsOrigin(null);
        setLocationHint('Location permission is required.');
        return;
      }

      const cached = await Location.getLastKnownPositionAsync({
        maxAge: 60_000,
        requiredAccuracy: 150,
      });
      if (cached) {
        applyGps(
          { lat: cached.coords.latitude, lng: cached.coords.longitude },
          true,
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
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
  }, [applyGps]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setLocating(false);
          setLocationHint('Location permission is required.');
          return;
        }

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        applyGps(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          true,
        );

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: MOVE_THRESHOLD_M,
            timeInterval: 3000,
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
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    };
  }, [applyGps]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const ride = await authenticated((token) => requestRide(token, pickup, destination));
      setDestination('');
      router.push({ pathname: '/ride/[id]', params: { id: ride.id } });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const mapPinRatio = useMemo(() => PIN_Y_RATIO, []);

  return (
    <View style={styles.page}>
      <View style={styles.mapLayer} pointerEvents={keyboardOpen ? 'none' : 'auto'}>
        {gpsOrigin ? (
          <LocationMap
            ref={mapRef}
            initial={gpsOrigin}
            onCenterChange={onCenterChange}
            showMyLocationButton={false}
            pinYRatio={mapPinRatio}
            locked={keyboardOpen}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            {locating ? (
              <ActivityIndicator color={color.brand} size="large" />
            ) : (
              <>
                <Text style={styles.placeholderText}>
                  {locationHint || 'Waiting for your current location'}
                </Text>
                <Pressable style={styles.retryBtn} onPress={() => { void goMyLocation(); }}>
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="My location"
        onPress={() => { void goMyLocation(); }}
        style={[styles.fab, { bottom: SHEET_COLLAPSED + 12 }]}
      >
        <Ionicons name="locate" size={22} color={color.brand} />
      </Pressable>

      <KeyboardAvoidingView
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View pointerEvents="box-none" style={styles.sheetViewport}>
          <MapBottomSheet collapsedHeight={SHEET_COLLAPSED}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
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

              <View style={styles.destField}>
                <Text style={styles.destLabel}>Destination</Text>
                <TextInput
                  value={destination}
                  onChangeText={setDestination}
                  placeholder="Street address or landmark"
                  placeholderTextColor={color.muted}
                  style={styles.destInput}
                  maxLength={300}
                  accessibilityLabel="Destination"
                  onFocus={() => { editingDestination.current = true; }}
                  onBlur={() => { editingDestination.current = false; }}
                  submitBehavior="blurAndSubmit"
                  returnKeyType="done"
                />
              </View>

              <Feedback error={error} loading={busy} />

              <Pressable
                accessibilityRole="button"
                disabled={busy || !pickup.trim() || !destination.trim()}
                onPress={submit}
                style={({ pressed }) => [
                  styles.requestBtn,
                  (busy || !pickup.trim() || !destination.trim()) && styles.requestDisabled,
                  pressed && styles.dim,
                ]}
              >
                <Text style={styles.requestText}>Request ride</Text>
              </Pressable>
            </ScrollView>
          </MapBottomSheet>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.tint },
  sheetViewport: { flex: 1 },
  // Fixed to screen height so keyboard open does not shrink/jump the map
  mapLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_H,
  },
  mapPlaceholder: {
    flex: 1,
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
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.field,
    backgroundColor: color.brand,
  },
  retryText: { color: color.surface, fontWeight: '700', fontSize: 15 },
  fab: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 5,
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
    elevation: 3,
  },
  sheetContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
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
  pickupLabel: { color: color.muted, fontSize: 12, fontWeight: '600' },
  pickupAddress: { color: color.ink, fontSize: 15, lineHeight: 21, fontWeight: '500' },
  hint: { color: color.amber, fontSize: 13, lineHeight: 18 },
  destField: { gap: spacing.xs },
  destLabel: { color: color.ink, fontSize: 14, fontWeight: '600' },
  destInput: {
    color: color.ink,
    minHeight: 50,
    fontSize: 16,
    paddingHorizontal: spacing.sm,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.field,
    backgroundColor: color.surface,
  },
  requestBtn: {
    minHeight: 50,
    borderRadius: radius.field,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestDisabled: { opacity: 0.45 },
  requestText: { color: color.surface, fontSize: 16, fontWeight: '700' },
  dim: { opacity: 0.75 },
});
