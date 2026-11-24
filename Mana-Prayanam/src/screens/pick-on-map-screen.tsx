import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reverseGeocode, searchPlaces, type MapCoords, type PlaceHit } from '@/api/geocode';
import { LocationMap, type LocationMapHandle } from '@/components/location-map';
import { getRideDraft, setRideDraft } from '@/location/ride-draft';
import { peekLocation, warmLocation } from '@/location/warm-location';
import { color, spacing } from '@/theme/brand';

export function PickOnMapScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string }>();
  const editingPickup = params.mode === 'pickup';
  const mapRef = useRef<LocationMapHandle>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeReq = useRef(0);
  const skipNextGeocode = useRef(false);

  const [initial, setInitial] = useState<MapCoords | null>(() => {
    const draft = getRideDraft();
    if (editingPickup && draft.pickup) return draft.pickup;
    return peekLocation();
  });
  const [center, setCenter] = useState<MapCoords | null>(() => {
    const draft = getRideDraft();
    if (editingPickup && draft.pickup) return draft.pickup;
    return peekLocation();
  });
  const [locating, setLocating] = useState(() => !peekLocation() && !getRideDraft().pickup);
  const [locationError, setLocationError] = useState('');
  const [address, setAddress] = useState(
    editingPickup ? 'Move the map to set pickup' : 'Move the map to set drop',
  );
  const [geocoding, setGeocoding] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (initial) return;
    let alive = true;
    setLocating(true);
    void warmLocation().then((coords) => {
      if (!alive) return;
      setLocating(false);
      if (!coords) {
        setLocationError('Enable location to pick on map.');
        return;
      }
      setInitial(coords);
      setCenter(coords);
    });
    return () => {
      alive = false;
    };
  }, [initial]);

  useEffect(() => {
    if (!initial) return;
    mapRef.current?.setSheetCover(0, 0.5);
  }, [initial]);

  const lookupAddress = useCallback((coords: MapCoords) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(() => {
      const req = ++geocodeReq.current;
      setGeocoding(true);
      void reverseGeocode(coords)
        .then((label) => {
          if (req !== geocodeReq.current) return;
          setAddress(label);
        })
        .catch(() => {
          if (req !== geocodeReq.current) return;
          setAddress(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        })
        .finally(() => {
          if (req !== geocodeReq.current) return;
          setGeocoding(false);
        });
    }, 450);
  }, []);

  const onCenterChange = useCallback((coords: MapCoords) => {
    setCenter(coords);
    if (skipNextGeocode.current) {
      skipNextGeocode.current = false;
      return;
    }
    setHits([]);
    lookupAddress(coords);
  }, [lookupAddress]);

  const onSearchChange = useCallback((text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      void (async () => {
        const near = center ?? peekLocation() ?? (await warmLocation()) ?? undefined;
        try {
          setHits(await searchPlaces(text, near));
        } catch {
          setHits([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 400);
  }, [center]);

  function pickHit(hit: PlaceHit) {
    Keyboard.dismiss();
    setQuery(hit.label);
    setHits([]);
    setAddress(hit.label);
    setCenter(hit.coords);
    skipNextGeocode.current = true;
    mapRef.current?.goTo(hit.coords, 17);
  }

  function confirm() {
    const label = address.trim();
    if (
      !label
      || label === 'Move the map to set drop'
      || label === 'Move the map to set pickup'
      || !center
    ) {
      return;
    }

    if (editingPickup) {
      setRideDraft({
        pickupLabel: label,
        pickup: center,
      });
      router.replace('/ride-quote');
      return;
    }

    const pickupCoords = getRideDraft().pickup ?? peekLocation() ?? initial;
    if (!pickupCoords) return;
    setRideDraft({
      pickupLabel: getRideDraft().pickupLabel || 'Current location',
      dropLabel: label,
      pickup: pickupCoords,
      drop: center,
    });
    router.replace('/ride-quote');
  }

  function goBack() {
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace('/destination');
  }

  if (!initial) {
    return (
      <View style={[styles.root, styles.loadingRoot]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, { marginBottom: 20 }, pressed && styles.dim]}
        >
          <Ionicons name="arrow-back" size={22} color="#1A237E" />
        </Pressable>
        {locating ? (
          <ActivityIndicator size="large" color={color.brand} />
        ) : (
          <Text style={styles.loadingText}>{locationError || 'Location unavailable.'}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.mapLayer}>
        <LocationMap
          ref={mapRef}
          initial={initial}
          onCenterChange={onCenterChange}
          onReady={() => mapRef.current?.setSheetCover(0, 0.5)}
        />
        <View pointerEvents="none" style={styles.pinWrap} accessible accessibilityLabel="Drop pin">
          <View style={styles.pin}>
            <View style={styles.pinHead}>
              <View style={styles.pinDot} />
            </View>
            <View style={styles.pinPoint} />
          </View>
          <View style={styles.pinShadow} />
        </View>
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.dim]}
        >
          <Ionicons name="arrow-back" size={22} color="#1A237E" />
        </Pressable>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#6B7280" />
          <TextInput
            value={query}
            onChangeText={onSearchChange}
            placeholder={editingPickup ? 'Search pickup location' : 'Search drop location'}
            placeholderTextColor="#9AA0B4"
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel={editingPickup ? 'Search pickup location' : 'Search drop location'}
          />
          {searching ? <ActivityIndicator size="small" color={color.brand} /> : null}
        </View>
      </View>

      {hits.length > 0 ? (
        <View style={[styles.hitsPanel, { top: insets.top + 64 }]}>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={hits}
            keyExtractor={(item) => `${item.coords.lat},${item.coords.lng},${item.label}`}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => pickHit(item)}
                style={({ pressed }) => [styles.hitRow, pressed && styles.dim]}
              >
                <Ionicons name="location-outline" size={18} color="#159447" />
                <Text style={styles.hitText} numberOfLines={2}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      <View style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Text style={styles.dropLabel}>{editingPickup ? 'Pickup at' : 'Drop at'}</Text>
        <Text style={styles.dropAddress} numberOfLines={2}>
          {geocoding ? 'Detecting location…' : address}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editingPickup ? 'Confirm pickup location' : 'Confirm drop location'}
          disabled={geocoding}
          onPress={confirm}
          style={({ pressed }) => [styles.confirmBtn, pressed && styles.dim, geocoding && styles.disabled]}
        >
          <Text style={styles.confirmText}>Confirm location</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D5DDD9' },
  loadingRoot: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A237E',
    textAlign: 'center',
  },
  mapLayer: { ...StyleSheet.absoluteFill },
  pinWrap: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -14,
    marginTop: -40,
    alignItems: 'center',
    width: 28,
  },
  pin: { alignItems: 'center' },
  pinHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E67E22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  pinPoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#E67E22',
    marginTop: -2,
  },
  pinShadow: {
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: 2,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchBox: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A237E',
    paddingVertical: 10,
  },
  hitsPanel: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    maxHeight: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  hitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  hitText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    lineHeight: 18,
  },
  bottomCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: 16,
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  dropLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dropAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A237E',
    lineHeight: 21,
    minHeight: 42,
  },
  confirmBtn: {
    marginTop: 4,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#159447',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabled: { opacity: 0.55 },
  dim: { opacity: 0.8 },
});
