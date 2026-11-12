import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePullToRefresh } from '@/components/pull-to-refresh';
import { color } from '@/theme/brand';

export function WelcomeScreen() {
  const onRefresh = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 450));
  }, []);
  const pull = usePullToRefresh(onRefresh);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={pull.control}
        bounces
      >
        <View style={styles.artwork}>
          <Image
            accessible
            accessibilityLabel="Mana Prayanam, Eluru"
            source={require('@/assets/images/mana-welcome.jpg')}
            resizeMode="cover"
            style={styles.image}
          />
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Get started" onPress={() => router.push('/login')} style={styles.button}>
          <Text style={styles.buttonText}>Get started</Text>
          <Text accessible={false} style={styles.arrow}>›</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.tint, alignItems: 'center' },
  scroll: { flex: 1, width: '100%' },
  scrollContent: { flexGrow: 1 },
  artwork: { flex: 1, minHeight: 520, width: '100%' },
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  button: { width: '90%', maxWidth: 480,
    marginTop: 12, marginBottom: 12, minHeight: 54, borderRadius: 16,
    backgroundColor: color.brand, borderWidth: 1, borderColor: color.brand,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  arrow: { color: color.surface, fontSize: 27, lineHeight: 32 },
  buttonText: { color: color.surface, fontSize: 17, fontWeight: '700' },
});
