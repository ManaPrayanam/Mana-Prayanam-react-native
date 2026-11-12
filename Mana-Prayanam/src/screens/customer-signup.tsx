import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorMessage } from '@/api/client';
import { checkMobile, loginWithMobile, signupWithMobile, type Gender, type Session } from '@/api/auth';
import { useSession } from '@/auth/session';
import { AuthHeader } from '@/components/auth-header';
import { usePullToRefresh } from '@/components/pull-to-refresh';
import { Feedback, Label } from '@/components/ridego-ui';
import { AuthField } from '@/components/auth-field';
import { authStyles } from '@/components/auth-styles';

const genders = [
  ['woman', 'Woman'], ['man', 'Man'], ['non_binary', 'Non-binary'], ['prefer_not_to_say', 'Prefer not to say'],
] as const;

export function CustomerSignup() {
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const login = mode === 'mobile';
  const { acceptSession } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [genderOpen, setGenderOpen] = useState(false);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [open, setOpen] = useState(false);
  const [verified, setVerified] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onRefresh = useCallback(async () => {
    Keyboard.dismiss();
    setGenderOpen(false);
    setError('');
    setOpen(false);
    setVerified(null);
    setOtp('');
  }, []);
  const pull = usePullToRefresh(onRefresh);

  async function openSheet() {
    if (!login && (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !gender)) {
      setError('Enter your name, a valid email, and select your gender.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { exists } = await checkMobile(mobile);
      if (!login && exists) {
        setError('This mobile number is already registered. Log in instead.');
        return;
      }
      if (login && !exists) {
        setError('No account found for this mobile number. Create an account first.');
        return;
      }
      Keyboard.dismiss();
      setGenderOpen(false);
      setOtp('');
      setOpen(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function closeSheet() {
    if (busy || verified) return;
    setOpen(false);
    setError('');
  }

  async function verify() {
    setBusy(true);
    setError('');
    try {
      const session = verified ?? (login
        ? await loginWithMobile(mobile, otp)
        : await signupWithMobile(name.trim(), email.trim(), gender as Gender, mobile, otp));
      if (!verified) {
        Keyboard.dismiss();
        setVerified(session);
        await new Promise<void>((resolve) => setTimeout(resolve, 1100));
      }
      await acceptSession(session);
      router.dismissTo('/');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={styles.page} edges={['left', 'right', 'bottom']}>
    <AuthHeader title={login ? "Log in with mobile" : "Create an account"} fallback="/login" />
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 12) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="never"
        refreshControl={pull.control}
      >
        <View style={styles.form}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {login ? 'Mobile number' : 'Your details'}
          </Text>
          {!login && <>
            <AuthField label="Full name" placeholder="Your name" value={name} onChangeText={setName} autoComplete="name" maxLength={120} />
            <AuthField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoComplete="email"
              autoCapitalize="none" keyboardType="email-address" maxLength={254} />
            <View>
              <Pressable accessibilityRole="combobox" accessibilityLabel="Gender"
                accessibilityState={{ expanded: genderOpen }} style={styles.dropdown}
                onPress={() => { Keyboard.dismiss(); setGenderOpen(!genderOpen); }}>
                <Text style={authStyles.fieldLabel}>Gender</Text>
                <Text style={gender ? authStyles.link : authStyles.note}>
                  {genders.find(([value]) => value === gender)?.[1] ?? 'Select gender'}
                </Text>
                <Text accessible={false} style={styles.chevron}>{genderOpen ? '▴' : '▾'}</Text>
              </Pressable>
              {genderOpen && <View style={styles.options}>
                {genders.map(([value, label]) => (
                  <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: gender === value }}
                    onPress={() => { setGender(value); setGenderOpen(false); }}
                    style={[styles.option, gender === value && styles.selected]}>
                    <Text style={authStyles.link}>{label}</Text>
                  </Pressable>
                ))}
              </View>}
            </View>
          </>}
          <AuthField label="Mobile number (+91)" placeholder="10-digit mobile number" value={mobile}
            onChangeText={(value) => setMobile(value.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad" autoComplete="tel-national" />
          <Feedback error={open ? '' : error} />
          <Pressable accessibilityRole="button" style={authStyles.submit} onPress={openSheet}>
            <Text style={authStyles.submitText}>Verify mobile number</Text>
          </Pressable>
          <Pressable accessibilityRole="link" style={authStyles.footer} onPress={() => router.replace('/login')}>
            <Text style={authStyles.note}>{login ? 'Use your email instead? ' : 'Already have an account? '}
              <Text style={authStyles.link}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={open} transparent animationType="slide" onRequestClose={closeSheet}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.sheet}>
          <View style={styles.sheetContent}>
            <Text accessibilityRole="header" style={styles.title}>
              {verified ? 'Mobile number verified!' : 'Verify your mobile number'}
            </Text>
            {verified
              ? <Text accessibilityLiveRegion="polite">{login ? 'You’re signed in.' : 'Your customer account is ready.'}</Text>
              : <>
                <Label muted>Enter the 4-digit code for +91 {mobile}.</Label>
                <AuthField label="Verification code" value={otp} editable={!busy}
                  onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad" autoComplete="one-time-code" maxLength={4} />
              </>}
            <Feedback error={error} loading={busy} />
            <Pressable accessibilityRole="button" onPress={verify}
              disabled={busy || (!verified && otp.length !== 4)}
              style={[authStyles.submit, (busy || (!verified && otp.length !== 4)) && authStyles.dim]}>
              <Text style={authStyles.submitText}>{verified ? 'Go to home' : 'Verify code'}</Text>
            </Pressable>
            {!verified && <Pressable accessibilityRole="button" style={authStyles.footer}
              onPress={closeSheet} disabled={busy}>
              <Text style={authStyles.link}>Edit mobile number</Text>
            </Pressable>}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FAFAFA' },
  scroll: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  form: {
    flexGrow: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
    gap: 16,
  },
  sectionTitle: { color: '#171717', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    minHeight: 58, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DADADA', borderRadius: 17 },
  chevron: { color: '#171717', fontSize: 30 },
  options: { marginTop: 4, borderWidth: 1, borderColor: '#DADADA', borderRadius: 12, overflow: 'hidden' },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  selected: { backgroundColor: '#FFF4CC' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  sheet: { backgroundColor: '#FAFAFA', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetContent: { padding: 24, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontWeight: '800', fontSize: 24, color: '#171717' },
});
