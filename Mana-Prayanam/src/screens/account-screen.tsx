import { router } from 'expo-router';
import { useState } from 'react';
import { updatePhone } from '@/api/drivers';
import { errorMessage } from '@/api/client';
import { useSession } from '@/auth/session';
import { Button, Card, Feedback, Field, Label, Screen } from '@/components/ridego-ui';

export function AccountScreen() {
  const { session, signOut, authenticated } = useSession();
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try { await action(); } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  }

  return <Screen title="Profile">
    <Card>
      <Label>{session?.user.name}</Label>
      <Label muted>{session?.user.email}</Label>
      <Label muted>{session?.user.role === 'driver' ? 'Driver' : 'Rider'}</Label>
      {session?.user.role === 'driver' && <>
        <Field label="Driver phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={30} />
        <Button label="Update phone" disabled={busy || !phone.trim()} onPress={() => submit(async () => {
          await authenticated((token) => updatePhone(token, phone));
          setMessage('Phone updated.');
        })} />
      </>}
      {message && <Label>{message}</Label>}
      <Feedback error={error} loading={busy} />
    </Card>
    <Button label="Sign out" secondary disabled={busy} onPress={() => submit(async () => {
      await signOut();
      router.replace('/');
    })} />
  </Screen>;
}
