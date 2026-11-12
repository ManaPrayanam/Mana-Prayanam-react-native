import { type ReactNode, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color } from '@/theme/brand';

const SCREEN_H = Dimensions.get('window').height;

type Props = {
  children: ReactNode;
  collapsedHeight?: number;
};

export function MapBottomSheet({
  children,
  collapsedHeight = Math.round(SCREEN_H * 0.34),
}: Props) {
  const insets = useSafeAreaInsets();
  const snaps = useMemo(() => {
    const mid = Math.round(SCREEN_H * 0.58);
    const expanded = Math.round(SCREEN_H * 0.82) - insets.top;
    return [collapsedHeight, mid, expanded].sort((a, b) => a - b);
  }, [collapsedHeight, insets.top]);

  const height = useSharedValue(snaps[0]);
  const startH = useSharedValue(snaps[0]);

  // Drag only from the handle — never react to keyboard (keeps map stable)
  const pan = Gesture.Pan()
    .onBegin(() => {
      startH.value = height.value;
    })
    .onUpdate((e) => {
      const next = startH.value - e.translationY;
      const min = snaps[0];
      const max = snaps[snaps.length - 1];
      height.value = Math.min(max, Math.max(min, next));
    })
    .onEnd((e) => {
      const projected = height.value - e.velocityY * 0.18;
      let nearest = snaps[0];
      let best = Math.abs(projected - snaps[0]);
      for (let i = 1; i < snaps.length; i += 1) {
        const d = Math.abs(projected - snaps[i]);
        if (d < best) {
          best = d;
          nearest = snaps[i];
        }
      }
      height.value = withSpring(nearest, { damping: 20, stiffness: 220 });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View style={[styles.sheet, sheetStyle]} pointerEvents="box-none">
      <GestureDetector gesture={pan}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
      </GestureDetector>
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '100%',
    backgroundColor: color.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 10,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D5D4',
  },
  body: {
    flex: 1,
  },
});
