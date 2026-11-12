import type { ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, radius, spacing } from '@/theme/brand';

export function Screen({ title, children, brand = false }: { title: string; children: ReactNode; brand?: boolean }) {
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.page}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {brand && <Text style={styles.wordmark}>Mana Prayanam</Text>}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
  </SafeAreaView>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Label({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <Text style={muted ? styles.muted : styles.label}>{children}</Text>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={color.muted} style={styles.input} {...props} />
  </View>;
}

export function Button({ label, onPress, secondary = false, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [
      styles.button, secondary && styles.secondary, (pressed || disabled) && styles.dim,
    ]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}

export function Feedback({ error, loading }: { error?: string; loading?: boolean }) {
  if (error) return <Text accessibilityRole="alert" style={styles.error}>{error}</Text>;
  return loading ? <ActivityIndicator accessibilityLabel="Loading" color={color.brand} /> : null;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.canvas },
  content: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  wordmark: { color: color.brand, fontSize: 24, fontWeight: '800', letterSpacing: -0.8 },
  title: { color: color.ink, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  card: { backgroundColor: color.surface, borderColor: color.line, borderWidth: 1,
    borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  label: { color: color.ink, fontSize: 16, fontWeight: '600' },
  muted: { color: color.muted, fontSize: 15, lineHeight: 21 },
  field: { gap: spacing.xs },
  input: { color: color.ink, minHeight: 50, fontSize: 16, paddingHorizontal: spacing.sm,
    borderColor: color.line, borderWidth: 1, borderRadius: radius.field, backgroundColor: color.surface },
  button: { minHeight: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, justifyContent: 'center',
    alignItems: 'center', borderRadius: radius.field, backgroundColor: color.brand },
  buttonText: { color: color.surface, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondary: { backgroundColor: color.tint },
  secondaryText: { color: color.brand },
  dim: { opacity: 0.65 },
  error: { color: color.danger, backgroundColor: color.dangerTint, borderRadius: radius.field, padding: spacing.sm },
});
