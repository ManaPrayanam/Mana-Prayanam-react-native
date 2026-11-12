import { useSession } from '@/auth/session';
import { Button, Feedback, Screen } from '@/components/ridego-ui';
import { BrandLogo } from '@/components/branding';
import { WelcomeScreen } from '@/screens/welcome-screen';
import { DriverScreen } from '@/screens/driver-screen';
import { RequestScreen } from '@/screens/request-screen';

export default function Home() {
  const { session, loading, recoveryError, restore } = useSession();
  if (loading || recoveryError) return <Screen title="Mana Prayanam">
    <BrandLogo />
    <Feedback loading={loading} error={recoveryError} />
    {recoveryError ? <Button label="Retry connection" onPress={restore} /> : null}
  </Screen>;
  if (!session) return <WelcomeScreen />;
  return session.user.role === 'driver' ? <DriverScreen /> : <RequestScreen />;
}
