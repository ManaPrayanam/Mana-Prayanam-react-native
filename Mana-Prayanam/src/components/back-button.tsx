import { Pressable, StyleSheet, Text } from 'react-native';
import { authStyles } from './auth-styles';

export function BackButton({ onPress, disabled = false }: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Go back"
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}>
      <Text accessible={false} style={authStyles.backText}>‹</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderWidth: 1, borderColor: '#B5B5B5', borderRadius: 22,
    justifyContent: 'center', alignItems: 'center' },
  pressed: { backgroundColor: '#EEEEEE' },
  disabled: { opacity: 0.55 },
});
