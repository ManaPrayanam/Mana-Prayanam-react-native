import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SessionProvider, useSession } from '@/auth/session';
import { color } from '@/theme/brand';

function Navigation() {
  const { session } = useSession();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: color.canvas },
        headerTintColor: color.brand,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: color.canvas },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="explore" options={{ headerShown: false }} />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="verify-otp" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="ride/[id]" options={{ title: 'Mana Prayanam' }} />
      </Stack.Protected>
      <Stack.Protected guard={session?.user.role === 'driver'}>
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
});
