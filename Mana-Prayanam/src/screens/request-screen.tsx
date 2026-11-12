import { router } from 'expo-router';
import { useState } from 'react';
import { requestRide } from '@/api/rides';
import { errorMessage } from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, Card, Feedback, Field, Screen } from '@/components/ridego-ui';

export function RequestScreen() {
  const { authenticated } = useSession();
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const ride = await authenticated((token) => requestRide(token, pickup, destination));
      setPickup('');
      setDestination('');
      router.push({ pathname: '/ride/[id]', params: { id: ride.id } });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <Screen title="Request a ride">
    <Card>
      <Field label="Pickup" placeholder="Street address or landmark" value={pickup} onChangeText={setPickup} maxLength={300} />
      <Field label="Destination" placeholder="Street address or landmark" value={destination}
        onChangeText={setDestination} maxLength={300} />
      <Feedback error={error} loading={busy} />
      <Button label="Request ride" disabled={busy || !pickup.trim() || !destination.trim()} onPress={submit} />
    </Card>
    <Button label="My rides" secondary onPress={() => router.push('/rides')} />
    <Button label="Account" secondary onPress={() => router.push('/account')} />
  </Screen>;
}
