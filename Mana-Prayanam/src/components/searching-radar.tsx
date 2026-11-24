import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { color } from '@/theme/brand';

function Ring({ delay, size }: { delay: number; size: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: 2200, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - progress.value),
    transform: [{ scale: 0.35 + progress.value * 0.9 }],
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

export function SearchingRadar({ label = 'Searching for drivers…' }: { label?: string }) {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.radar}>
        <Ring delay={0} size={160} />
        <Ring delay={700} size={160} />
        <Ring delay={1400} size={160} />
        <View style={styles.core} />
      </View>
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.sub}>Looking for nearby captains</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: '28%',
    zIndex: 8,
  },
  radar: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: color.brand,
    backgroundColor: 'rgba(21, 148, 71, 0.08)',
  },
  core: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: color.brand,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
});
