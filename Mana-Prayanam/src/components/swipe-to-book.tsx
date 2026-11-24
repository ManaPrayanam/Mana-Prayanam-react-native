import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const TRACK_H = 56;
const KNOB = 48;
const PAD = 4;

type Props = {
  label: string;
  /** Ionicons name OR image source for the knob */
  icon?: keyof typeof Ionicons.glyphMap;
  iconSource?: ImageSourcePropType;
  disabled?: boolean;
  loading?: boolean;
  onSwipeComplete: () => void;
};

export function SwipeToBook({
  label,
  icon = 'bicycle',
  iconSource,
  disabled = false,
  loading = false,
  onSwipeComplete,
}: Props) {
  const trackW = useSharedValue(0);
  const x = useSharedValue(0);
  const locked = useSharedValue(false);

  useEffect(() => {
    if (!loading) {
      locked.value = false;
      x.value = withSpring(0, { damping: 18, stiffness: 220 });
    }
  }, [loading, locked, x]);

  const pan = Gesture.Pan()
    .enabled(!disabled && !loading)
    .activeOffsetX(8)
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      'worklet';
      if (locked.value) return;
      const max = Math.max(0, trackW.value - KNOB - PAD * 2);
      x.value = Math.min(max, Math.max(0, e.translationX));
    })
    .onEnd(() => {
      'worklet';
      if (locked.value) return;
      const max = Math.max(0, trackW.value - KNOB - PAD * 2);
      if (x.value > max * 0.72) {
        locked.value = true;
        x.value = withSpring(max, { damping: 20, stiffness: 240 }, (finished) => {
          'worklet';
          if (finished) runOnJS(onSwipeComplete)();
        });
      } else {
        x.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const knobStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateX: x.value }] };
  });

  const labelStyle = useAnimatedStyle(() => {
    'worklet';
    const max = Math.max(1, trackW.value - KNOB - PAD * 2);
    return {
      opacity: interpolate(x.value, [0, max * 0.55], [1, 0], Extrapolation.CLAMP),
    };
  });

  return (
    <View
      style={[styles.track, (disabled || loading) && styles.disabled]}
      onLayout={(e) => {
        trackW.value = e.nativeEvent.layout.width;
      }}
      accessibilityRole="adjustable"
      accessibilityLabel={loading ? 'Booking' : `Swipe to ${label}`}
    >
      <Animated.Text style={[styles.label, labelStyle]}>
        {loading ? 'Booking…' : `Swipe to ${label}`}
      </Animated.Text>
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.knob, knobStyle]}>
          {loading ? (
            <Ionicons name="hourglass-outline" size={22} color="#FFFFFF" />
          ) : iconSource ? (
            <Image source={iconSource} style={styles.knobImg} resizeMode="contain" />
          ) : (
            <Ionicons name={icon} size={22} color="#FFFFFF" />
          )}
        </Animated.View>
      </GestureDetector>
      {!loading ? (
        <View style={styles.hint} pointerEvents="none">
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.55)" />
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_H,
    borderRadius: 14,
    backgroundColor: '#3A673D',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  label: {
    alignSelf: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  knob: {
    position: 'absolute',
    left: PAD,
    top: (TRACK_H - KNOB) / 2,
    width: KNOB,
    height: KNOB,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobImg: {
    width: 44,
    height: 40,
  },
  hint: {
    position: 'absolute',
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
});
