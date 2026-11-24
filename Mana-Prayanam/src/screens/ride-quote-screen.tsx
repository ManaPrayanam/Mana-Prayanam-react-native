import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/api/client';
import { fetchRideQuote, requestRide, type RideQuote } from '@/api/rides';
import { useSession } from '@/auth/session';
import { ArriveSound } from '@/components/arrive-sound';
import { PayIcon, type PayIconKind } from '@/components/payment-icons';
import { RouteMap, type RouteMapHandle } from '@/components/route-map';
import { SwipeToBook } from '@/components/swipe-to-book';
import { getRideDraft, setRideDraft } from '@/location/ride-draft';
import { color, spacing } from '@/theme/brand';

type Vehicle = 'bike' | 'auto';
type PayMethod = PayIconKind;
type BookPhase = 'quote' | 'searching' | 'matched';

const DUMMY_DRIVERS = {
  bike: {
    name: 'Ravi Kumar',
    rating: '4.8',
    trips: '2.1k',
    vehicle: 'Honda Activa',
    plate: 'AP 39 BK 4521',
    etaMin: 8,
    distKm: 2.6,
    photo: 'https://randomuser.me/api/portraits/men/32.jpg',
  },
  auto: {
    name: 'Suresh Naidu',
    rating: '4.9',
    trips: '3.4k',
    vehicle: 'Bajaj RE Auto',
    plate: 'AP 39 AT 8821',
    etaMin: 8,
    distKm: 2.4,
    photo: 'https://randomuser.me/api/portraits/men/45.jpg',
  },
} as const;

const PAY_OPTIONS: PayMethod[] = ['Cash', 'UPI', 'Card'];

/** Colors sampled from the quote sheet mock */
const G = {
  primary: '#3A673D',
  primaryDark: '#2F5533',
  soft: '#4A7A4D',
  border: '#3A673D',
  muted: '#6B7280',
  text: '#1F2937',
  line: '#D1D5DB',
  yellow: '#E8B84A',
  red: '#D32F2F',
  chipBg: '#FFFFFF',
  sheet: '#FFFFFF',
};

function Sparkles() {
  return (
    <View style={styles.sparkles}>
      <View style={[styles.spark, styles.spark1]} />
      <View style={[styles.spark, styles.spark2]} />
      <View style={[styles.spark, styles.spark3]} />
      <View style={[styles.spark, styles.spark4]} />
    </View>
  );
}

function DashedLine() {
  return (
    <View style={styles.dashCol}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={styles.dashSeg} />
      ))}
    </View>
  );
}

export function RideQuoteScreen() {
  const insets = useSafeAreaInsets();
  const { authenticated } = useSession();
  const mapRef = useRef<RouteMapHandle>(null);
  const [draftTick, setDraftTick] = useState(0);
  const draft = getRideDraft();
  const [quote, setQuote] = useState<RideQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle>(() => getRideDraft().vehicle || 'bike');
  const [payMethod, setPayMethod] = useState<PayMethod>('Cash');
  const [payOpen, setPayOpen] = useState(false);
  const [booking, setBooking] = useState(false);
  const [phase, setPhase] = useState<BookPhase>('quote');
  const [rideId, setRideId] = useState<string | null>(null);
  const [rideOtp, setRideOtp] = useState<string | null>(null);
  const [liveEtaMin, setLiveEtaMin] = useState<number | null>(null);
  const [arrivedNotice, setArrivedNotice] = useState(false);
  const [driverArrived, setDriverArrived] = useState(false);
  const [arriveSoundKey, setArriveSoundKey] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeCount = useRef(0);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  // Banner only when driver reaches pickup; show at most twice
  useEffect(() => {
    if (liveEtaMin !== 0 || phase !== 'matched' || noticeCount.current > 0) return;
    setDriverArrived(true);

    const showNotice = () => {
      if (noticeCount.current >= 2) return;
      noticeCount.current += 1;
      setArrivedNotice(true);
      setArriveSoundKey((n) => n + 1);
      Vibration.vibrate(400);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => {
        setArrivedNotice(false);
        if (noticeCount.current < 2) {
          noticeTimer.current = setTimeout(showNotice, 6000);
        }
      }, 4500);
    };

    showNotice();
  }, [liveEtaMin, phase]);

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
  }, [load, draftTick]);

  function chooseVehicle(next: Vehicle) {
    setVehicle(next);
    setRideDraft({ vehicle: next });
  }

  async function book() {
    if (!quote || booking || phase !== 'quote') return;
    const { pickupLabel: pLabel, dropLabel: dLabel } = getRideDraft();
    setBooking(true);
    setPhase('searching');
    setError('');
    setDriverArrived(false);
    setArrivedNotice(false);
    setLiveEtaMin(null);
    setRideOtp(null);
    noticeCount.current = 0;
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setRideDraft({ vehicle });
    mapRef.current?.startSearchRadar();

    // Fire booking in background; stay on this screen for search → match UX
    void authenticated((token) =>
      requestRide(token, pLabel || 'Current location', dLabel || 'Drop', vehicle),
    )
      .then((ride) => {
        setRideId(ride.id);
        if (ride.start_otp) setRideOtp(String(ride.start_otp));
      })
      .catch((err) => setError(errorMessage(err)));

    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      const driver = DUMMY_DRIVERS[vehicle];
      // Assigned vehicle starts 2–3 km away and heads toward pickup
      const rad = (48 * Math.PI) / 180;
      const distKm = driver.distKm;
      const cosLat = Math.cos((quote.pickup.lat * Math.PI) / 180);
      const driverPos = {
        lat: quote.pickup.lat + (distKm / 111.32) * Math.cos(rad),
        lng: quote.pickup.lng + (distKm / (111.32 * Math.max(cosLat, 0.2))) * Math.sin(rad),
      };
      mapRef.current?.stopSearchRadar();
      setLiveEtaMin(driver.etaMin);
      mapRef.current?.showApproachingDriver(driverPos, driver.etaMin, distKm, vehicle);
      setRideOtp((prev) => prev || String(Math.floor(1000 + Math.random() * 9000)));
      setPhase('matched');
      setBooking(false);
    }, 4500);
  }

  function editPickup() {
    router.push({ pathname: '/pick-on-map', params: { mode: 'pickup' } });
  }

  function editDrop() {
    router.push({
      pathname: '/destination',
      params: {
        pickup: draft.pickupLabel || 'Current location',
        destination: draft.dropLabel === 'Drop' ? '' : (draft.dropLabel || ''),
      },
    });
  }

  function swapPoints() {
    const current = getRideDraft();
    if (!current.pickup || !current.drop) return;
    setRideDraft({
      pickupLabel: current.dropLabel,
      dropLabel: current.pickupLabel,
      pickup: current.drop,
      drop: current.pickup,
    });
    setDraftTick((n) => n + 1);
  }

  const selected = quote?.quotes[vehicle];
  const other: Vehicle = vehicle === 'bike' ? 'auto' : 'bike';
  const pickupLabel = draft.pickupLabel || 'Current location';
  const dropLabel = draft.dropLabel || 'Drop';
  const etaMin = selected
    ? Math.max(2, Math.min(8, Math.round(selected.durationMin * 0.22) || 3))
    : 3;
  const selectedTitle = vehicle === 'bike' ? 'Bike Direct' : 'Auto';
  const otherTitle = other === 'bike' ? 'Bike' : 'Auto';
  const matchedDriver = DUMMY_DRIVERS[vehicle];
  const searching = phase === 'searching';
  const matched = phase === 'matched';

  return (
    <View style={styles.root}>
      <ArriveSound playKey={arriveSoundKey} />
      <View style={styles.mapLayer}>
        {quote ? (
          <RouteMap
            ref={mapRef}
            pickup={quote.pickup}
            drop={quote.drop}
            route={quote.geometry.coordinates}
            nearby={quote.nearbyVehicles}
            vehicle={vehicle}
            pickupLabel={pickupLabel}
            dropLabel={dropLabel}
            bottomPadRatio={0.62}
            onEditPickup={phase === 'quote' ? editPickup : undefined}
            onEditDrop={phase === 'quote' ? editDrop : undefined}
            onApproachEta={setLiveEtaMin}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            {loading ? <ActivityIndicator size="large" color={color.brand} /> : null}
          </View>
        )}
      </View>

      {arrivedNotice ? (
        <View style={[styles.fakeNotif, { top: insets.top + 8 }]} pointerEvents="none">
          <View style={styles.fakeNotifIcon}>
            <Ionicons name="notifications" size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fakeNotifTitle}>Driver has arrived</Text>
            <Text style={styles.fakeNotifBody}>
              {DUMMY_DRIVERS[vehicle].name} is at your pickup location
            </Text>
          </View>
        </View>
      ) : null}

      <View
        style={[styles.mapChrome, { top: insets.top + (arrivedNotice ? 78 : 10) }]}
        pointerEvents="box-none"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
            if (searching) return;
            if (matched && rideId) {
              router.replace(`/ride/${rideId}`);
              return;
            }
            if (matched) {
              setPhase('quote');
              return;
            }
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)');
          }}
          style={({ pressed }) => [styles.roundBtn, pressed && styles.dim, searching && styles.disabled]}
        >
          <Ionicons name="arrow-back" size={18} color="#111827" />
        </Pressable>
        {!searching ? (
          <View style={styles.mapActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset map orientation"
              onPress={() => mapRef.current?.resetNorth()}
              style={({ pressed }) => [styles.roundBtn, pressed && styles.dim]}
            >
              <Ionicons name="navigate-outline" size={16} color="#111827" />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to my location"
              onPress={() => mapRef.current?.goToPickup()}
              style={({ pressed }) => [styles.roundBtn, pressed && styles.dim]}
            >
              <Ionicons name="locate-outline" size={18} color="#111827" />
            </Pressable>
          </View>
        ) : (
          <View />
        )}
      </View>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {matched ? (
          <>
            <View style={styles.handle} />
            <Text style={styles.matchedBadge}>
              {driverArrived ? 'Driver has arrived' : 'Driver on the way'}
            </Text>
            <View style={styles.driverRow}>
              <Image
                source={{ uri: matchedDriver.photo }}
                style={styles.driverPhoto}
              />
              <View style={styles.driverCopy}>
                <Text style={styles.driverName}>{matchedDriver.name}</Text>
                <Text style={styles.driverMeta}>
                  ★ {matchedDriver.rating} · {matchedDriver.trips} trips
                </Text>
                <Text style={styles.driverVehicle}>
                  {matchedDriver.vehicle} · {matchedDriver.plate}
                </Text>
              </View>
              <View style={styles.etaBlock}>
                {driverArrived ? (
                  <>
                    <Text style={styles.etaBig}>—</Text>
                    <Text style={styles.etaUnit}>Arrived</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.etaBig}>{liveEtaMin ?? matchedDriver.etaMin}</Text>
                    <Text style={styles.etaUnit}>mins away</Text>
                  </>
                )}
              </View>
            </View>
            <View style={styles.matchedVehicleRow}>
              <Image
                source={
                  vehicle === 'bike'
                    ? require('@/assets/images/fleet/bike-3d.png')
                    : require('@/assets/images/fleet/auto-3d.png')
                }
                style={styles.matchedVehicleImg}
                resizeMode="contain"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.matchedVehicleTitle}>
                  {vehicle === 'bike' ? 'Bike' : 'Auto'}{' '}
                  {driverArrived ? 'at pickup' : 'coming'}
                </Text>
                <Text style={styles.matchedVehicleSub}>
                  {driverArrived
                    ? `At ${pickupLabel}`
                    : `${liveEtaMin ?? matchedDriver.etaMin} mins away · to ${pickupLabel}`}
                </Text>
              </View>
              <Text style={styles.matchedFare}>₹{selected?.fareInr ?? '—'}</Text>
            </View>
            {rideOtp ? (
              <View style={styles.otpCard}>
                <Text style={styles.otpLabel}>Share this OTP with your driver</Text>
                <Text style={styles.otpCode}>{rideOtp}</Text>
                <Text style={styles.otpHint}>Start the ride only after the driver enters this code</Text>
              </View>
            ) : null}
            {error ? <Text style={styles.errorInline}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (rideId) router.replace(`/ride/${rideId}`);
                else router.replace('/(tabs)');
              }}
              style={({ pressed }) => [styles.trackBtn, pressed && styles.dim]}
            >
              <Text style={styles.trackBtnText}>Track ride</Text>
            </Pressable>
          </>
        ) : searching ? (
          <>
            <View style={styles.handle} />
            <View style={styles.searchingSheet}>
              <Text style={styles.searchingSheetTitle}>Searching for drivers</Text>
              <Text style={styles.searchingSheetSub}>
                {vehicle === 'bike' ? 'Bike' : 'Auto'} · {payMethod} · ₹{selected?.fareInr ?? '—'}
              </Text>
            </View>
          </>
        ) : loading ? (
          <View style={styles.sheetLoading}>
            <ActivityIndicator color={G.primary} />
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

            {/* Bike | Auto toggle — exact mock layout */}
            <View style={styles.toggleTrack}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: vehicle === 'bike' }}
                onPress={() => chooseVehicle('bike')}
                style={[styles.toggleBtn, vehicle === 'bike' && styles.toggleBtnOn]}
              >
                <Image
                  source={require('@/assets/images/fleet/bike-3d.png')}
                  style={styles.toggleBikeIcon}
                  resizeMode="contain"
                />
                <Text style={[styles.toggleLabel, vehicle === 'bike' && styles.toggleLabelOn]}>
                  Bike
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: vehicle === 'auto' }}
                onPress={() => chooseVehicle('auto')}
                style={[styles.toggleBtn, vehicle === 'auto' && styles.toggleBtnOn]}
              >
                <Image
                  source={require('@/assets/images/fleet/auto-3d.png')}
                  style={styles.toggleAutoIcon}
                  resizeMode="contain"
                />
                <Text style={[styles.toggleLabel, vehicle === 'auto' && styles.toggleLabelOn]}>
                  Auto
                </Text>
              </Pressable>
            </View>

            {/* Fare: big selected + alt */}
            <View style={styles.fareBlock}>
              <View style={styles.fareSelected}>
                <View style={styles.priceLine}>
                  <Text style={styles.price}>₹{selected.fareInr}</Text>
                  <Sparkles />
                </View>
                <Text style={styles.fareTitle}>{selectedTitle}</Text>
              </View>
              <View style={styles.vDivider} />
              <Pressable
                accessibilityRole="button"
                onPress={() => chooseVehicle(other)}
                style={styles.fareOther}
              >
                <Text style={styles.otherName}>{otherTitle}</Text>
                <Text style={styles.otherPrice}>₹{quote.quotes[other].fareInr}</Text>
              </Pressable>
            </View>

            {/* Distance | Duration | ETA */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="git-branch-outline" size={15} color={G.soft} />
                <Text style={styles.metaText}>{quote.distanceKm.toFixed(1)} km</Text>
              </View>
              <View style={styles.metaPipe} />
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={15} color={G.soft} />
                <Text style={styles.metaText}>{quote.durationMin} min</Text>
              </View>
              <View style={styles.metaPipe} />
              <View style={styles.etaChip}>
                <Image
                  source={
                    vehicle === 'bike'
                      ? require('@/assets/images/fleet/bike-3d.png')
                      : require('@/assets/images/fleet/auto-3d.png')
                  }
                  style={styles.etaVehicleIcon}
                  resizeMode="contain"
                />
                <Text style={styles.etaChipText}>Arrives in {etaMin} min</Text>
              </View>
            </View>

            {/* Pickup / Drop + swap */}
            <View style={styles.pointsRow}>
              <View style={styles.pointsLeft}>
                <View style={styles.pointLine}>
                  <View style={styles.greenRing}>
                    <View style={styles.greenCore} />
                  </View>
                  <Pressable onPress={editPickup} style={styles.pointPress}>
                    <Text style={styles.pointText} numberOfLines={1}>{pickupLabel}</Text>
                  </Pressable>
                </View>
                <View style={styles.dashRow}>
                  <DashedLine />
                </View>
                <View style={styles.pointLine}>
                  <Ionicons name="location-sharp" size={22} color={G.red} />
                  <Pressable onPress={editDrop} style={styles.pointPress}>
                    <Text style={styles.pointText} numberOfLines={1}>{dropLabel}</Text>
                  </Pressable>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Swap pickup and drop"
                onPress={swapPoints}
                style={({ pressed }) => [styles.swap, pressed && styles.dim]}
              >
                <Ionicons name="swap-vertical" size={18} color="#4B5563" />
              </Pressable>
            </View>

            {/* Payment + coupon */}
            <View style={styles.extrasRow}>
              <Pressable
                style={styles.pill}
                accessibilityRole="button"
                accessibilityLabel="Choose payment method"
                onPress={() => setPayOpen(true)}
              >
                <PayIcon kind={payMethod} size={22} />
                <Text style={styles.pillText}>{payMethod}</Text>
                <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
              </Pressable>
              <Pressable style={[styles.pill, styles.pillGrow]} accessibilityRole="button">
                <Ionicons name="ticket" size={16} color={G.yellow} />
                <Text style={[styles.pillText, styles.pillGrowText]}>Apply coupon</Text>
                <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
              </Pressable>
            </View>

            {error ? <Text style={styles.errorInline}>{error}</Text> : null}

            <SwipeToBook
              label={vehicle === 'bike' ? 'Book Bike' : 'Book Auto'}
              iconSource={
                vehicle === 'auto'
                  ? require('@/assets/images/fleet/auto-3d.png')
                  : require('@/assets/images/fleet/bike-3d.png')
              }
              disabled={booking}
              loading={booking}
              onSwipeComplete={() => { void book(); }}
            />
          </>
        ) : null}
      </View>

      <Modal
        visible={payOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPayOpen(false)}
      >
        <Pressable style={styles.payBackdrop} onPress={() => setPayOpen(false)}>
          <Pressable style={styles.paySheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.payTitle}>Payment method</Text>
            {PAY_OPTIONS.map((opt) => {
              const on = payMethod === opt;
              return (
                <Pressable
                  key={opt}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setPayMethod(opt);
                    setPayOpen(false);
                  }}
                  style={[styles.payRow, on && styles.payRowOn]}
                >
                  <PayIcon kind={opt} size={28} />
                  <Text style={styles.payRowText}>{opt}</Text>
                  {on ? <Ionicons name="checkmark-circle" size={20} color={color.brand} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
  fakeNotif: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  fakeNotifIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakeNotifTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  fakeNotifBody: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  mapChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  mapActions: { gap: 10 },
  roundBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: G.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginBottom: 14,
  },
  sheetLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  sheetHint: { fontSize: 14, fontWeight: '600', color: G.muted },

  toggleTrack: {
    alignSelf: 'center',
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: G.border,
    borderRadius: 26,
    padding: 3,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 22,
  },
  toggleBtnOn: {
    backgroundColor: G.primary,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: G.primary,
  },
  toggleLabelOn: {
    color: '#FFFFFF',
  },
  toggleBikeIcon: {
    width: 26,
    height: 22,
  },
  toggleAutoIcon: {
    width: 26,
    height: 22,
  },
  etaVehicleIcon: {
    width: 18,
    height: 15,
  },

  fareBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  fareSelected: {
    flex: 1,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  price: {
    fontSize: 44,
    fontWeight: '800',
    color: G.primary,
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  sparkles: {
    width: 22,
    height: 28,
    marginLeft: 4,
    marginTop: 2,
  },
  spark: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    backgroundColor: G.yellow,
    transform: [{ rotate: '-28deg' }],
  },
  spark1: { width: 12, top: 4, left: 2 },
  spark2: { width: 9, top: 10, left: 8 },
  spark3: { width: 11, top: 16, left: 0 },
  spark4: { width: 7, top: 22, left: 10 },
  fareTitle: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
    color: G.text,
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
    height: 52,
    backgroundColor: G.line,
    marginHorizontal: 18,
  },
  fareOther: {
    minWidth: 78,
    justifyContent: 'center',
    gap: 4,
  },
  otherName: {
    fontSize: 15,
    fontWeight: '600',
    color: G.muted,
  },
  otherPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4B5563',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '700',
    color: G.text,
  },
  metaPipe: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: G.line,
    marginHorizontal: 10,
  },
  etaChip: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: G.primary,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 16,
  },
  etaChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  pointsLeft: {
    flex: 1,
  },
  pointLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 30,
  },
  greenRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: G.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  greenCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: G.soft,
  },
  pointPress: { flex: 1 },
  pointText: {
    fontSize: 16,
    fontWeight: '700',
    color: G.text,
  },
  dashRow: {
    width: 22,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dashCol: {
    alignItems: 'center',
    gap: 3,
  },
  dashSeg: {
    width: 2,
    height: 3,
    borderRadius: 1,
    backgroundColor: '#C4C8D0',
  },
  swap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  extrasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: G.chipBg,
  },
  pillGrow: { flex: 1 },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    color: G.text,
  },
  pillGrowText: {
    flex: 1,
    fontWeight: '600',
    color: '#374151',
  },

  errorText: { fontSize: 14, fontWeight: '600', color: '#B91C1C', textAlign: 'center' },
  errorInline: { fontSize: 12, fontWeight: '600', color: '#B91C1C', marginBottom: 8 },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: G.primary,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  payBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  paySheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 8,
  },
  payTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: G.text,
    marginBottom: 6,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  payRowOn: {
    borderColor: G.primary,
    backgroundColor: '#F3F8F4',
  },
  payRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: G.text,
  },
  searchingSheet: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
  },
  searchingSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: G.text,
  },
  searchingSheetSub: {
    fontSize: 13,
    fontWeight: '600',
    color: G.muted,
  },
  matchedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: color.tint,
    color: color.brand,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 12,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  driverPhoto: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E5E7EB',
  },
  driverCopy: { flex: 1, gap: 2 },
  driverName: { fontSize: 17, fontWeight: '800', color: G.text },
  driverMeta: { fontSize: 13, fontWeight: '600', color: G.muted },
  driverVehicle: { fontSize: 13, fontWeight: '700', color: G.text, marginTop: 2 },
  etaBlock: {
    alignItems: 'center',
    backgroundColor: color.tint,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  etaBig: { fontSize: 22, fontWeight: '800', color: color.brand, lineHeight: 24 },
  etaUnit: { fontSize: 11, fontWeight: '700', color: color.brand },
  matchedVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    marginBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: G.line,
  },
  matchedVehicleImg: { width: 52, height: 40 },
  matchedVehicleTitle: { fontSize: 15, fontWeight: '800', color: G.text },
  matchedVehicleSub: { fontSize: 12, fontWeight: '600', color: G.muted, marginTop: 2 },
  matchedFare: { fontSize: 18, fontWeight: '800', color: G.text },
  otpCard: {
    marginTop: 4,
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F0FAF3',
    borderWidth: 1,
    borderColor: '#159447',
    alignItems: 'center',
    gap: 4,
  },
  otpLabel: { fontSize: 12, fontWeight: '600', color: '#166534' },
  otpCode: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 8,
    color: '#14532D',
    fontVariant: ['tabular-nums'],
  },
  otpHint: { fontSize: 11, fontWeight: '500', color: '#6B7280', textAlign: 'center' },
  trackBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: G.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  dim: { opacity: 0.85 },
});
