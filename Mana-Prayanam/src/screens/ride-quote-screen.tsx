import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/api/client';
import { fetchRideQuote, requestRide, type RideQuote } from '@/api/rides';
import { useSession } from '@/auth/session';
import { RouteMap } from '@/components/route-map';
import { getRideDraft } from '@/location/ride-draft';
import { color, spacing } from '@/theme/brand';

type Vehicle = 'bike' | 'auto';

const FILTERS = ['All', 'Women Preferred', 'Priority'] as const;

function dropClock(mins: number) {
  const d = new Date(Date.now() + mins * 60_000);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function RideQuoteScreen() {
  const insets = useSafeAreaInsets();
  const { authenticated } = useSession();
  const draft = getRideDraft();
  const [quote, setQuote] = useState<RideQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle>('bike');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [booking, setBooking] = useState(false);

  const load = useCallback(async () => {
    const { pickup, drop } = getRideDraft();
    if (!pickup || !drop) {
      setError('Pickup or drop location is missing.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await authenticated((token) => fetchRideQuote(token, pickup, drop));
      setQuote(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load]);

  async function book() {
    if (!quote || booking) return;
    const { pickupLabel, dropLabel } = getRideDraft();
    setBooking(true);
    try {
      const ride = await authenticated((token) =>
        requestRide(token, pickupLabel || 'Current location', dropLabel || 'Drop'),
      );
      router.replace(`/ride/${ride.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBooking(false);
    }
  }

  const selected = quote?.quotes[vehicle];
  const pickupLabel = draft.pickupLabel || 'Pickup';
  const dropLabel = draft.dropLabel || 'Drop';
  const bargainFare = useMemo(
    () => (selected ? Math.max(20, selected.fareInr - 2) : 0),
    [selected],
  );

  return (
    <View style={styles.root}>
      <View style={styles.mapLayer}>
        {quote ? (
          <RouteMap
            pickup={quote.pickup}
            drop={quote.drop}
            route={quote.geometry.coordinates}
            nearby={quote.nearbyVehicles}
            vehicle={vehicle}
            pickupLabel={pickupLabel}
            dropLabel={dropLabel}
            bottomPadRatio={0.52}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            {loading ? <ActivityIndicator size="large" color={color.brand} /> : null}
          </View>
        )}
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          style={({ pressed }) => [styles.roundBtn, pressed && styles.dim]}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
      </View>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {loading ? (
          <View style={styles.sheetLoading}>
            <ActivityIndicator color={color.brand} />
            <Text style={styles.sheetHint}>Finding best route & fares…</Text>
          </View>
        ) : error && !quote ? (
          <View style={styles.sheetLoading}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => { void load(); }} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : quote && selected ? (
          <>
            <View style={styles.handle} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filters}
            >
              {FILTERS.map((item) => {
                const on = filter === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setFilter(item)}
                    style={[styles.filterChip, on && styles.filterChipOn]}
                  >
                    <Text style={[styles.filterText, on && styles.filterTextOn]}>{item}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.meta}>
              {quote.distanceKm.toFixed(1)} km · ~{quote.durationMin} min
            </Text>

            <ScrollView
              style={styles.vehicleScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.vehicleList}
            >
              <VehicleRow
                selected={vehicle === 'bike'}
                title="Bike Direct"
                tagline="Quick Bike rides"
                eta={`${quote.quotes.bike.durationMin} mins away`}
                dropAt={`Drop ${dropClock(quote.quotes.bike.durationMin)}`}
                seats="1"
                fare={quote.quotes.bike.fareInr}
                icon={require('@/assets/images/fleet/bike.png')}
                onPress={() => setVehicle('bike')}
              />
              <VehicleRow
                selected={vehicle === 'auto'}
                title="Auto"
                tagline="Comfortable auto rides"
                eta={`${quote.quotes.auto.durationMin} mins away`}
                dropAt={`Drop ${dropClock(quote.quotes.auto.durationMin)}`}
                seats="3"
                fare={quote.quotes.auto.fareInr}
                icon={require('@/assets/images/fleet/auto.png')}
                onPress={() => setVehicle('auto')}
              />
            </ScrollView>

            {error ? <Text style={styles.errorInline}>{error}</Text> : null}

            <View style={styles.footer}>
              <Pressable style={styles.cashBtn} accessibilityRole="button">
                <Ionicons name="cash-outline" size={18} color="#159447" />
                <Text style={styles.cashText}>Cash</Text>
                <Ionicons name="chevron-down" size={14} color="#6B7280" />
              </Pressable>

              <View style={styles.bookWrap}>
                <View style={styles.bargainBadge}>
                  <Text style={styles.bargainText}>Ride at ₹{bargainFare}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Book now"
                  disabled={booking}
                  onPress={() => { void book(); }}
                  style={({ pressed }) => [styles.bookBtn, pressed && styles.dim, booking && styles.disabled]}
                >
                  <Text style={styles.bookText}>{booking ? 'Booking…' : 'Book Now'}</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

function VehicleRow({
  selected,
  title,
  tagline,
  eta,
  dropAt,
  seats,
  fare,
  icon,
  onPress,
}: {
  selected: boolean;
  title: string;
  tagline: string;
  eta: string;
  dropAt: string;
  seats: string;
  fare: number;
  icon: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.vehicleRow,
        selected && styles.vehicleSelected,
        pressed && styles.dim,
      ]}
    >
      <View style={styles.vehicleIconWrap}>
        <Image source={icon} style={styles.vehicleIcon} resizeMode="contain" />
      </View>
      <View style={styles.vehicleCopy}>
        <Text style={styles.vehicleTitle}>{title}</Text>
        <Text style={styles.vehicleTag}>{tagline}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaItem}>{eta}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaItem}>{dropAt}</Text>
          <Ionicons name="person-outline" size={12} color="#6B7280" style={styles.seatIcon} />
          <Text style={styles.metaItem}>{seats}</Text>
        </View>
      </View>
      <Text style={styles.vehicleFare}>₹{fare}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8EEE9' },
  mapLayer: { ...StyleSheet.absoluteFill },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EEE9',
  },
  topBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 5,
  },
  roundBtn: {
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
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '56%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -3 },
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 10,
  },
  sheetLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  sheetHint: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  filters: {
    gap: 8,
    paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  filterChipOn: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  filterTextOn: { color: '#FFFFFF' },
  meta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8,
  },
  vehicleScroll: { maxHeight: 210 },
  vehicleList: { gap: 10, paddingBottom: 8 },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  vehicleSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FBFF',
  },
  vehicleIconWrap: {
    width: 72,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  vehicleIcon: {
    width: 72,
    height: 48,
    backgroundColor: 'transparent',
  },
  vehicleCopy: { flex: 1, gap: 2 },
  vehicleTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  vehicleTag: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  metaItem: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  metaDot: { marginHorizontal: 4, color: '#9CA3AF' },
  seatIcon: { marginLeft: 6, marginRight: 2 },
  vehicleFare: { fontSize: 18, fontWeight: '800', color: '#111827' },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  cashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cashText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  bookWrap: { flex: 1, position: 'relative' },
  bargainBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    zIndex: 2,
    backgroundColor: '#159447',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  bargainText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  bookBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F5C518',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookText: { fontSize: 16, fontWeight: '800', color: '#111827' },
  errorText: { fontSize: 14, fontWeight: '600', color: '#B91C1C', textAlign: 'center' },
  errorInline: { fontSize: 12, fontWeight: '600', color: '#B91C1C', marginBottom: 4 },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#159447',
  },
  retryText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
  dim: { opacity: 0.85 },
});
