import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSession } from '@/auth/session';
import { Button, Feedback, Screen } from '@/components/ridego-ui';
import { WelcomeScreen } from '@/screens/welcome-screen';
import { color } from '@/theme/brand';

export default function RootIndex() {
  const { session, loading, recoveryError, restore } = useSession();

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={color.brand} />
      </View>
    );
  }

  if (recoveryError) {
    return (
      <Screen title="Connection" onRefresh={restore}>
        <Feedback error={recoveryError} />
        <Button label="Retry connection" onPress={restore} />
      </Screen>
    );
  }

  if (session) return <Redirect href="/(tabs)" />;
  return <WelcomeScreen />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.tint,
  },
});
