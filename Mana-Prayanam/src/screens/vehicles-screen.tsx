import { useCallback, useState } from 'react';
import { addVehicle, listVehicles } from '@/api/vehicles';
import { errorMessage } from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, Card, Feedback, Field, Label, Screen } from '@/components/ridego-ui';
import { useFocusedData } from '@/hooks/use-focused-data';

export function VehiclesScreen() {
  const { authenticated } = useSession();
  const load = useCallback(() => authenticated(listVehicles), [authenticated]);
  const { data, error, refresh } = useFocusedData(load);
  const [registration, setRegistration] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [seats, setSeats] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  async function save() {
    setBusy(true);
    setActionError('');
    try {
      await authenticated((token) => addVehicle(token, { registration, make, model, seats: Number(seats) }));
      setRegistration('');
      setMake('');
      setModel('');
      setSeats('');
      refresh();
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <Screen title="Vehicles">
    <Feedback error={error} loading={!data} />
    {data?.map((vehicle) => <Card key={vehicle.id}>
      <Label>{vehicle.make} {vehicle.model}</Label>
      <Label muted>{vehicle.registration} · {vehicle.seats} seats</Label>
    </Card>)}
    <Card>
      <Label>Add a vehicle</Label>
      <Field label="Registration" value={registration} onChangeText={setRegistration} autoCapitalize="characters" maxLength={32} />
      <Field label="Make" value={make} onChangeText={setMake} maxLength={80} />
      <Field label="Model" value={model} onChangeText={setModel} maxLength={80} />
      <Field label="Seats" value={seats} onChangeText={setSeats} keyboardType="number-pad" maxLength={2} />
      <Feedback error={actionError} loading={busy} />
      <Button label="Save vehicle" disabled={busy || !registration.trim() || !make.trim() || !model.trim() ||
        !/^(?:[1-9]|1[0-9]|20)$/.test(seats)} onPress={save} />
    </Card>
  </Screen>;
}
