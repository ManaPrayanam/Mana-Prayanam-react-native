import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchPlaces, type MapCoords, type PlaceHit } from '@/api/geocode';
import { setRideDraft } from '@/location/ride-draft';
import { peekLocation, warmLocation } from '@/location/warm-location';
import { color, spacing } from '@/theme/brand';

const RECENT_DROPS = [
  {
    id: 'drop-1',
    title: 'Indiranagar 100 Feet Rd',
    address: '100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru',
  },
  {
    id: 'drop-2',
    title: 'HSR Layout Sector 2',
    address: '27th Main Rd, Sector 2, HSR Layout, Bengaluru',
  },
  {
    id: 'drop-3',
    title: 'Koramangala 5th Block',
    address: '80 Feet Rd, 5th Block, Koramangala, Bengaluru',
  },
  {
    id: 'drop-4',
    title: 'MG Road Metro',
    address: 'Mahatma Gandhi Road, Shanthala Nagar, Bengaluru',
  },
  {
    id: 'drop-5',
    title: 'Whitefield ITPL',
    address: 'ITPL Main Rd, Whitefield, Bengaluru',
  },
] as const;

export function DestinationScreen() {
  const params = useLocalSearchParams<{ pickup?: string; destination?: string }>();
  const pickup = typeof params.pickup === 'string' ? params.pickup : 'Current location';
  const [destination, setDestination] = useState(
    typeof params.destination === 'string' ? params.destination : '',
  );
  const inputRef = useRef<{ focus: () => void; blur: () => void } | null>(null);
  const leaving = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchReq = useRef(0);
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    void warmLocation();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const runSearch = useCallback((text: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = text.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      const req = ++searchReq.current;
      void (async () => {
        const near = peekLocation() ?? (await warmLocation()) ?? undefined;
        try {
          const rows = await searchPlaces(q, near);
          if (req !== searchReq.current) return;
          setHits(rows);
        } catch {
          if (req !== searchReq.current) return;
          setHits([]);
        } finally {
          if (req !== searchReq.current) return;
          setSearching(false);
        }
      })();
    }, 350);
  }, []);

  const onDropChange = useCallback((text: string) => {
    setDestination(text);
    runSearch(text);
  }, [runSearch]);

  const clearDrop = useCallback(() => {
    setDestination('');
    setHits([]);
    setSearching(false);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchReq.current += 1;
    inputRef.current?.focus();
  }, []);

  /** Dismiss keypad and wait for window layout to settle, then run `go`. */
  const afterKeyboardGone = useCallback((go: () => void) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      hideSub.remove();
      clearTimeout(fallback);
      setTimeout(go, 40);
    };
    const hideSub = Keyboard.addListener('keyboardDidHide', finish);
    inputRef.current?.blur();
    Keyboard.dismiss();
    const fallback = setTimeout(finish, 280);
  }, []);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    afterKeyboardGone(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    });
  }, [afterKeyboardGone]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => sub.remove();
  }, [leave]);

  function goToQuote(dropLabel: string, dropCoords: MapCoords) {
    const pickupCoords = peekLocation();
    if (!pickupCoords) return;
    setRideDraft({
      pickupLabel: pickup || 'Current location',
      dropLabel,
      pickup: pickupCoords,
      drop: dropCoords,
    });
    afterKeyboardGone(() => {
      router.replace('/ride-quote');
    });
  }

  async function confirm(value?: string, coords?: MapCoords) {
    const next = (value ?? destination).trim();
    if (!next || resolving || leaving.current) return;
    if (coords) {
      goToQuote(next, coords);
      return;
    }
    const fromHit = hits.find((h) => h.label === next);
    if (fromHit) {
      goToQuote(fromHit.label, fromHit.coords);
      return;
    }
    setResolving(true);
    try {
      const rows = await searchPlaces(next, peekLocation() ?? undefined);
      const hit = rows[0];
      if (!hit) {
        setResolving(false);
        return;
      }
      goToQuote(hit.label, hit.coords);
    } catch {
      setResolving(false);
    }
  }

  function openMapPicker() {
    afterKeyboardGone(() => {
      router.push('/pick-on-map');
    });
  }

  const showClear = destination.length > 0 && !searching;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={leave}
          style={({ pressed }) => [styles.backBtn, pressed && styles.dim]}
        >
          <Ionicons name="arrow-back" size={22} color="#1A237E" />
        </Pressable>
        <Text style={styles.headerTitle}>Drop location</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.form}>
          <View style={styles.timelineCol} pointerEvents="none">
            <View style={styles.pickupIcon}>
              <View style={styles.pickupDot} />
            </View>
            <View style={styles.dashTrack}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View key={i} style={styles.dash} />
              ))}
            </View>
            <View style={styles.dropIcon}>
              <Ionicons name="arrow-down" size={14} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.fieldsCol}>
            <View style={styles.pickupBox}>
              <Text style={styles.pickupText} numberOfLines={1}>
                {pickup || 'Current location'}
              </Text>
            </View>

            <View style={styles.dropBoxWrap}>
              <TextInput
                ref={inputRef as never}
                value={destination}
                onChangeText={onDropChange}
                placeholder="Drop location"
                placeholderTextColor="#9AA0B4"
                style={styles.dropBox}
                maxLength={300}
                accessibilityLabel="Drop location"
                returnKeyType="search"
                blurOnSubmit
                onSubmitEditing={() => {
                  if (hits[0]) confirm(hits[0].label);
                  else confirm();
                }}
              />
              {searching ? (
                <ActivityIndicator style={styles.dropTrailing} size="small" color={color.brand} />
              ) : showClear ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear drop location"
                  hitSlop={8}
                  onPress={clearDrop}
                  style={({ pressed }) => [styles.clearBtn, pressed && styles.dim]}
                >
                  <Ionicons name="close-circle" size={22} color="#9AA0B4" />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pick on map"
              onPress={openMapPicker}
              style={({ pressed }) => [styles.mapChip, pressed && styles.dim]}
            >
              <Ionicons name="location-sharp" size={16} color="#1A237E" />
              <Text style={styles.mapChipText}>Map</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.divider} />

        {hits.length > 0 ? (
          <>
            <Text style={styles.recentTitle}>Search results</Text>
            <View style={styles.recentList}>
              {hits.map((hit, index) => (
                <Pressable
                  key={`${hit.coords.lat},${hit.coords.lng},${hit.label}`}
                  accessibilityRole="button"
                  accessibilityLabel={hit.label}
                  onPress={() => { void confirm(hit.label, hit.coords); }}
                  style={({ pressed }) => [
                    styles.recentRow,
                    index < hits.length - 1 && styles.recentDivider,
                    pressed && styles.dim,
                  ]}
                >
                  <Ionicons name="location-outline" size={22} color="#6B7280" style={styles.recentIcon} />
                  <View style={styles.recentCopy}>
                    <Text style={styles.recentName} numberOfLines={2}>{hit.label}</Text>
                    {hit.distanceKm != null ? (
                      <Text style={styles.recentAddress}>
                        {hit.distanceKm < 1
                          ? `${Math.round(hit.distanceKm * 1000)} m away`
                          : `${hit.distanceKm.toFixed(1)} km away`}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={styles.sectionGap} />
          </>
        ) : null}

        <Text style={styles.recentTitle}>Previously used</Text>
        <View style={styles.recentList}>
          {RECENT_DROPS.map((ride, index) => (
            <Pressable
              key={ride.id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${ride.title}`}
              onPress={() => { void confirm(ride.title); }}
              style={({ pressed }) => [
                styles.recentRow,
                index < RECENT_DROPS.length - 1 && styles.recentDivider,
                pressed && styles.dim,
              ]}
            >
              <Ionicons name="time-outline" size={22} color="#6B7280" style={styles.recentIcon} />
              <View style={styles.recentCopy}>
                <Text style={styles.recentName} numberOfLines={1}>{ride.title}</Text>
                <Text style={styles.recentAddress} numberOfLines={1}>{ride.address}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.md,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#1A237E',
  },
  headerSpacer: { width: 40 },
  form: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    gap: 12,
  },
  timelineCol: {
    width: 28,
    alignItems: 'center',
    paddingTop: 14,
  },
  pickupIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#159447',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  dashTrack: {
    width: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36,
    marginVertical: 6,
  },
  dash: {
    width: 2,
    height: 4,
    borderRadius: 1,
    backgroundColor: '#C5CAD6',
  },
  dropIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E67E22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldsCol: {
    flex: 1,
    gap: 12,
  },
  pickupBox: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#EEF2F7',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  pickupText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A237E',
  },
  dropBoxWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  dropBox: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1A237E',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingRight: 44,
    fontSize: 15,
    fontWeight: '600',
    color: '#1A237E',
  },
  dropTrailing: {
    position: 'absolute',
    right: 12,
  },
  clearBtn: {
    position: 'absolute',
    right: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
  },
  mapChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A237E',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D0D5DD',
    marginTop: 20,
    marginBottom: 16,
  },
  sectionGap: {
    height: 16,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  recentList: {
    borderRadius: 12,
    backgroundColor: '#FAFBFC',
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 10,
  },
  recentDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  recentIcon: { marginTop: 1 },
  recentCopy: { flex: 1, gap: 2 },
  recentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  recentAddress: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  dim: { opacity: 0.75 },
});
