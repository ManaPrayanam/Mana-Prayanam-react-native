import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { acceptRide, availableRides } from '@/api/rides';
import { listVehicles } from '@/api/vehicles';
import { errorMessage } from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, Card, Feedback, Label, Screen } from '@/components/ridego-ui';
import { RideCard } from '@/components/ride-card';
import { useFocusedData } from '@/hooks/use-focused-data';

export function DriverScreen() {
  const { authenticated } = useSession();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const load = useCallback(() => authenticated(async (token) => {
    const [rides, vehicles] = await Promise.all([availableRides(token), listVehicles(token)]);
    return { rides, vehicles };
  }), [authenticated]);
  const { data, error, refresh } = useFocusedData(load, 15000);
  const vehicleId = data?.vehicles.find(({ id }) => id === selected)?.id ?? data?.vehicles[0]?.id;

  async function accept(id: string) {
    if (!vehicleId) return;
    setBusy(true);
    setActionError('');
    try {
      const ride = await authenticated((token) => acceptRide(token, id, vehicleId));
      router.push({ pathname: '/ride/[id]', params: { id: ride.id } });
    } catch (cause) {
      setActionError(errorMessage(cause));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return <Screen title="Available rides" onRefresh={async () => { refresh(); }}>
    <Feedback error={actionError || error} loading={!data || busy} />
    {data && <Card>
      <Label>Vehicle for this ride</Label>
      {data.vehicles.length === 0 && <Label muted>Add a vehicle before accepting a ride.</Label>}
      {data.vehicles.map((vehicle) => <Button key={vehicle.id}
        label={vehicle.registration + (vehicle.id === vehicleId ? ' · selected' : '')}
        secondary={vehicle.id !== vehicleId} disabled={busy} onPress={() => setSelected(vehicle.id)} />)}
    </Card>}
    {data?.rides.length === 0 && <Label muted>No ride requests right now.</Label>}
    {data?.rides.map((ride) => <RideCard key={ride.id} ride={ride}>
      <Button label="Accept ride" disabled={!vehicleId || busy} onPress={() => accept(ride.id)} />
    </RideCard>)}
    <Button label="Refresh requests" secondary onPress={refresh} />
    <Button label="Vehicles" secondary onPress={() => router.push('/vehicles')} />
  </Screen>;
}
