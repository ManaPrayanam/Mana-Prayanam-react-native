import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { authStyles as styles } from './auth-styles';

export function AuthField({
  label,
  password,
  error,
  ...props
}: TextInputProps & { label: string; password?: boolean; error?: string }) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.fieldBlock}>
    <View style={[styles.field, error ? styles.fieldError : null]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor="#676767"
        secureTextEntry={password && !visible} style={styles.input} />
      {password && <Pressable accessibilityRole="button"
        accessibilityLabel={(visible ? 'Hide ' : 'Show ') + label}
        hitSlop={8} onPress={() => setVisible(!visible)} style={styles.reveal}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color="#606060" />
      </Pressable>}
    </View>
    {!!error && <Text style={styles.fieldHint}>{error}</Text>}
  </View>;
}

