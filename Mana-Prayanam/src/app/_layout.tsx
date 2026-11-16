import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';
import { SessionProvider, useSession } from '@/auth/session';
import { color } from '@/theme/brand';

// Hide Reanimated "Dependencies…web" warnings from navigation libs on native
configureReanimatedLogger({
  level: ReanimatedLogLevel.error,
  strict: false,
});

const screenOptions = {
  headerStyle: { backgroundColor: color.canvas },
  headerTintColor: color.brand,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: color.canvas },
  headerBackButtonDisplayMode: 'minimal' as const,
};

function Navigation() {
  const { session, loading } = useSession();
  const signedIn = Boolean(session);
  const isDriver = session?.user.role === 'driver';

  // Avoid mounting Protected stacks while session is still restoring
  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={color.brand} />
      </View>
    );
  }

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="explore" options={{ headerShown: false }} />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="verify-otp" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="destination"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="pick-on-map"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen
          name="ride-quote"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            gestureEnabled: true,
          }}
        />
        <Stack.Screen name="ride/[id]" options={{ title: 'Mana Prayanam' }} />
      </Stack.Protected>
      <Stack.Protected guard={isDriver}>
        <Stack.Screen name="vehicles" options={{ title: 'Mana Prayanam' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SessionProvider>
        <StatusBar style="dark" />
        <Navigation />
      </SessionProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.canvas,
  },
});
