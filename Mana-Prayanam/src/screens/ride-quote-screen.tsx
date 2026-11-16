import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

export function RideQuoteScreen() {
  const insets = useSafeAreaInsets();
  const { authenticated } = useSession();
  const draft = getRideDraft();
  const [quote, setQuote] = useState<RideQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle>('bike');
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
            bottomPadRatio={0.48}
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
          style={({ pressed }) => [styles.backBtn, pressed && styles.dim]}
        >
          <Ionicons name="arrow-back" size={22} color="#1A237E" />
        </Pressable>
      </View>

      {quote ? (
        <View style={styles.labels} pointerEvents="none">
          <View style={[styles.labelPill, styles.labelPickup]}>
            <View style={styles.dotGreen} />
            <Text style={styles.labelText} numberOfLines={1}>{pickupLabel}</Text>
          </View>
          <View style={[styles.labelPill, styles.labelDrop]}>
            <View style={styles.dotOrange} />
            <Text style={styles.labelText} numberOfLines={1}>{dropLabel}</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        {loading ? (
          <View style={styles.sheetLoading}>
            <ActivityIndicator color={color.brand} />
            <Text style={styles.sheetHint}>Getting distance & fare…</Text>
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
                title="Bike"
                subtitle={`Quick bike · ${quote.quotes.bike.durationMin} mins away`}
                fare={quote.quotes.bike.fareInr}
                icon={require('@/assets/images/bike-icon.jpg')}
                onPress={() => setVehicle('bike')}
              />
              <VehicleRow
                selected={vehicle === 'auto'}
                title="Auto"
                subtitle={`Roomy auto · ${quote.quotes.auto.durationMin} mins away`}
                fare={quote.quotes.auto.fareInr}
                icon={require('@/assets/images/auto-icon.jpg')}
                onPress={() => setVehicle('auto')}
              />
            </ScrollView>

            {error ? <Text style={styles.errorInline}>{error}</Text> : null}

            <View style={styles.bookRow}>
              <View style={styles.cashChip}>
                <Ionicons name="cash-outline" size={18} color="#159447" />
                <Text style={styles.cashText}>Cash</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Book now"
                disabled={booking}
                onPress={() => { void book(); }}
                style={({ pressed }) => [styles.bookBtn, pressed && styles.dim, booking && styles.disabled]}
              >
                <Text style={styles.bookText}>
                  {booking ? 'Booking…' : `Book ${vehicle === 'bike' ? 'Bike' : 'Auto'} · ₹${selected.fareInr}`}
                </Text>
              </Pressable>
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
  subtitle,
  fare,
  icon,
  onPress,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
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
      <Image source={icon} style={styles.vehicleIcon} resizeMode="contain" />
      <View style={styles.vehicleCopy}>
        <Text style={styles.vehicleTitle}>{title}</Text>
        <Text style={styles.vehicleSub}>{subtitle}</Text>
      </View>
      <Text style={styles.vehicleFare}>₹{fare}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D5DDD9' },
  mapLayer: { ...StyleSheet.absoluteFill },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D5DDD9',
  },
  topBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 5,
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
  labels: {
    position: 'absolute',
    top: '18%',
    left: spacing.md,
    right: spacing.md,
    gap: 8,
  },
  labelPill: {
    alignSelf: 'flex-start',
    maxWidth: '78%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  labelPickup: { marginLeft: 8 },
  labelDrop: { alignSelf: 'flex-end', marginRight: 8 },
  labelText: { fontSize: 13, fontWeight: '600', color: '#1A237E', maxWidth: 180 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#159447' },
  dotOrange: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E67E22' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '52%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
  },
  sheetLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  sheetHint: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  meta: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 10,
  },
  vehicleScroll: { maxHeight: 180 },
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
    backgroundColor: '#FAFBFC',
  },
  vehicleSelected: {
    borderColor: '#159447',
    backgroundColor: '#F0FDF4',
  },
  vehicleIcon: { width: 56, height: 40 },
  vehicleCopy: { flex: 1, gap: 2 },
  vehicleTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  vehicleSub: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  vehicleFare: { fontSize: 18, fontWeight: '800', color: '#111827' },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  cashChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  cashText: { fontSize: 14, fontWeight: '700', color: '#111827' },
  bookBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#159447',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
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
