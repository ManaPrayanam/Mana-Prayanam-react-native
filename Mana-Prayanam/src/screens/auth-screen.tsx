import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View,
} from 'react-native';
import Animated, {
  Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkMobile } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { AuthHeader } from '@/components/auth-header';
import { AuthField } from '@/components/auth-field';
import { Feedback } from '@/components/ridego-ui';
import { authStyles as styles } from '@/components/auth-styles';

const ART_HEIGHT = 230;
const timing = { duration: 280, easing: Easing.out(Easing.cubic) };

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const keyboardProgress = useSharedValue(0);
  const [mobile, setMobile] = useState('');
  const [remember, setRemember] = useState(true);
  const [mobileError, setMobileError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => {
      keyboardProgress.value = withTiming(1, timing);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardProgress.value = withTiming(0, timing);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboardProgress]);

  const artStyle = useAnimatedStyle(() => ({
    height: interpolate(keyboardProgress.value, [0, 1], [ART_HEIGHT, 0]),
    opacity: interpolate(keyboardProgress.value, [0, 0.55, 1], [1, 0.35, 0]),
    transform: [{ translateY: interpolate(keyboardProgress.value, [0, 1], [0, -28]) }],
    marginBottom: interpolate(keyboardProgress.value, [0, 1], [0, -8]),
    overflow: 'hidden',
  }));

  const headingStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(keyboardProgress.value, [0, 1], [29, 22]),
    marginBottom: interpolate(keyboardProgress.value, [0, 1], [12, 4]),
  }));

  async function submit() {
    setError('');
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setMobileError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    try {
      const { exists } = await checkMobile(mobile);
      if (!exists) {
        setError('No account found for this mobile number. Create an account first.');
        return;
      }
      Keyboard.dismiss();
      router.push({
        pathname: '/verify-otp',
        params: { mobile, remember: remember ? '1' : '0', mode: 'login' },
      });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function openTerms(kind: 'terms' | 'privacy') {
    Alert.alert(
      kind === 'terms' ? 'Terms of Service' : 'Privacy Policy',
      kind === 'terms'
        ? 'Mana Prayanam terms of service will be available here.'
        : 'Mana Prayanam privacy policy will be available here.',
    );
  }

  return <SafeAreaView style={styles.loginPage} edges={['left', 'right', 'bottom']}>
    <AuthHeader title="Log in" fallback="/" />
    <KeyboardAvoidingView style={styles.loginPage} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      <ScrollView
        style={styles.loginPage}
        contentContainerStyle={[styles.loginScroll, { paddingBottom: Math.max(insets.bottom, 12) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="never"
        bounces={false}
      >
        <Animated.View style={artStyle}>
          <Image accessible={false}
            source={require('@/assets/images/mana-login.jpg')}
            resizeMode="cover" style={styles.loginArtwork} />
        </Animated.View>
        <View style={[styles.sheet, styles.loginSheetFill]}>
          <View style={styles.loginBody}>
            <Animated.Text accessibilityRole="header" style={[styles.heading, headingStyle]}>
              Welcome to Mana Prayanam
            </Animated.Text>
            <AuthField label="Mobile number (+91)" value={mobile}
              onChangeText={(value) => {
                setMobile(value.replace(/\D/g, '').slice(0, 10));
                setMobileError('');
                setError('');
              }}
              keyboardType="phone-pad" autoComplete="tel-national"
              placeholder="10-digit mobile number" editable={!busy} error={mobileError} />
            {Platform.OS !== 'web' && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }}
              disabled={busy} onPress={() => setRemember(!remember)} style={styles.remember}>
              <Text style={styles.checkbox}>{remember ? '✓' : ''}</Text><Text style={styles.note}>Remember me</Text>
            </Pressable>}
            <Feedback error={error} loading={busy} />
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }}
              disabled={busy} onPress={submit} style={[styles.submit, busy && styles.dim]}>
              <Text style={styles.submitText}>Log in</Text>
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.note}>New to Mana Prayanam?</Text>
              <Pressable accessibilityRole="link" disabled={busy}
                onPress={() => router.push('/register')} style={styles.footer}>
                <Text style={styles.link}>Create an account</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.legal}>
            By continuing, you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => openTerms('terms')}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.legalLink} onPress={() => openTerms('privacy')}>Privacy Policy</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
