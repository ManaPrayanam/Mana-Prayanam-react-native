import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loginWithMobile, signupWithMobile, type Gender } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { useSession } from '@/auth/session';
import { AuthHeader } from '@/components/auth-header';
import { Feedback } from '@/components/ridego-ui';
import { authStyles } from '@/components/auth-styles';

const LENGTH = 4;

export function OtpVerifyScreen() {
  const { acceptSession } = useSession();
  const params = useLocalSearchParams<{
    mobile?: string;
    remember?: string;
    mode?: string;
    name?: string;
    email?: string;
    gender?: string;
  }>();
  const mobile = typeof params.mobile === 'string' ? params.mobile : '';
  const remember = params.remember !== '0';
  const signup = params.mode === 'signup';

  const [digits, setDigits] = useState(['', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    const timer = setTimeout(() => inputs.current[0]?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  function updateDigit(index: number, value: string) {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      setError('');
      return;
    }

    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, LENGTH).split('');
      const next = ['', '', '', ''];
      chars.forEach((char, offset) => { next[offset] = char; });
      setDigits(next);
      setError('');
      const focusAt = Math.min(chars.length, LENGTH - 1);
      inputs.current[focusAt]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    setError('');
    if (index < LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  function onKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function verify() {
    const otp = digits.join('');
    if (!/^\d{4}$/.test(otp)) {
      setError('Enter the 4-digit OTP.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Mobile number is missing. Go back and try again.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const session = signup
        ? await signupWithMobile(
          String(params.name ?? '').trim(),
          String(params.email ?? '').trim(),
          String(params.gender ?? '') as Gender,
          mobile,
          otp,
        )
        : await loginWithMobile(mobile, otp);
      await acceptSession(session, remember);
      Keyboard.dismiss();
      router.dismissTo('/');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={authStyles.page} edges={['left', 'right']}>
    <AuthHeader title="Verify OTP" fallback="/login" disabled={busy} />
    <KeyboardAvoidingView style={authStyles.page} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>We sent a 4-digit code to +91 {mobile || '••••••••••'}</Text>
        <View style={styles.boxes} accessibilityLabel="OTP digits">
          {digits.map((digit, index) => (
            <TextInput
              key={index}
              ref={(node) => { inputs.current[index] = node; }}
              value={digit}
              onChangeText={(value) => updateDigit(index, value)}
              onKeyPress={({ nativeEvent }) => onKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={index === 0 ? LENGTH : 1}
              editable={!busy}
              style={[styles.box, error ? styles.boxError : null]}
              accessibilityLabel={`Digit ${index + 1}`}
            />
          ))}
        </View>
        <Feedback error={error} loading={busy} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || digits.join('').length !== 4 }}
          disabled={busy || digits.join('').length !== 4}
          onPress={verify} style={[authStyles.submit, (busy || digits.join('').length !== 4) && authStyles.dim]}>
          <Text style={authStyles.submitText}>Verify & continue</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.back()} style={authStyles.footer}>
          <Text style={authStyles.link}>Change mobile number</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 28,
    gap: 18,
  },
  title: {
    color: '#171717',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#606060',
    fontSize: 14,
    textAlign: 'center',
  },
  boxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  box: {
    width: 48,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#DADADA',
    borderRadius: 10,
    backgroundColor: '#FAFAFA',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#171717',
    padding: 0,
  },
  boxError: { borderColor: '#C0392B' },
});
