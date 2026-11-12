import { router, type Href } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from './back-button';

export function AuthHeader({ title, fallback, disabled = false }: {
  title: string; fallback: Href; disabled?: boolean;
}) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.bar}>
        <BackButton disabled={disabled}
          onPress={() => router.canGoBack() ? router.back() : router.replace(fallback)} />
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <View style={styles.spacer} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FAFAFA', borderBottomWidth: 1, borderBottomColor: '#D4D4D4' },
  bar: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, color: '#171717', textAlign: 'center', fontSize: 18, fontWeight: '700' },
  spacer: { width: 44 },
});
