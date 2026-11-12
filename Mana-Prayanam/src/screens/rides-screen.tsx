import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { listRides, rideHistory, updateRide } from '@/api/rides';
import { errorMessage } from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, Card, Feedback, Label, Screen } from '@/components/ridego-ui';
import { RideCard, statusLabel } from '@/components/ride-card';
import { useFocusedData } from '@/hooks/use-focused-data';

export function RidesScreen() {
  const { authenticated } = useSession();
  const load = useCallback(() => authenticated(listRides), [authenticated]);
  const { data, error, refresh } = useFocusedData(load);
  return <Screen title="My rides">
    <Feedback error={error} loading={!data} />
    {data?.length === 0 && <Label muted>No rides yet.</Label>}
    {data?.map((ride) => <RideCard key={ride.id} ride={ride} status={ride.status}>
      <Button label="View ride" secondary onPress={() => router.push({ pathname: '/ride/[id]', params: { id: ride.id } })} />
    </RideCard>)}
    <Button label="Refresh rides" secondary onPress={refresh} />
  </Screen>;
}

export function RideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { authenticated, session } = useSession();
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => authenticated(async (token) => {
    const rides = await listRides(token);
    const ride = rides.find((item) => item.id === id);
    if (!ride) throw new Error('Ride not found.');
    return { ride, history: await rideHistory(token, ride.id) };
  }), [authenticated, id]);
  const { data, error, refresh } = useFocusedData(load, 10000);
  const driver = session?.user.role === 'driver';

  async function change(status: 'in_progress' | 'completed' | 'cancelled') {
    if (!data) return;
    setBusy(true);
    setActionError('');
    try {
      await authenticated((token) => updateRide(token, data.ride.id, status));
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      refresh();
      setBusy(false);
    }
  }

  const status = data?.ride.status;
  return <Screen title="Ride details">
    <Feedback error={actionError || error} loading={!data || busy} />
    {data && <>
      <RideCard ride={data.ride} status={status}>
        {driver && status === 'accepted' && <Button label="Start ride" disabled={busy} onPress={() => change('in_progress')} />}
        {driver && status === 'in_progress' && <Button label="Complete ride" disabled={busy} onPress={() => change('completed')} />}
        {(status === 'accepted' || status === 'requested') &&
          <Button label="Cancel ride" secondary disabled={busy} onPress={() => change('cancelled')} />}
      </RideCard>
      <Card>
        <Label>Status history</Label>
        {data.history.map((event, index) => <Label key={index} muted>
          {statusLabel[event.status]} · {new Date(event.created_at).toLocaleString()}
        </Label>)}
      </Card>
    </>}
    <Button label="Refresh status" secondary onPress={refresh} />
  </Screen>;
}
