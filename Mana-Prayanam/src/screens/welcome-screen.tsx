import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function WelcomeScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.artwork}>
        <Image
          accessible
          accessibilityLabel="Mana Prayanam, Eluru"
          source={require('@/assets/images/mana-welcome.jpg')}
          resizeMode="cover"
          style={styles.image}
        />
      </View>
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
  screen: { flex: 1, backgroundColor: '#F0FAF3', alignItems: 'center' },
  artwork: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  button: { width: '90%', maxWidth: 480,
    marginTop: 12, marginBottom: 12, minHeight: 54, borderRadius: 16,
    backgroundColor: '#101211', borderWidth: 1, borderColor: '#FFFFFF44',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  arrow: { color: '#FFFFFF', fontSize: 27, lineHeight: 32 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
