import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { type ReactNode, useCallback, useMemo, useRef } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { color } from '@/theme/brand';

/** Locked at first read — never follow keyboard window height changes. */
const LOCKED_H = Dimensions.get('window').height;

type Props = {
  children: ReactNode;
  contentContainerStyle?: object;
  onExpandedChange?: (expanded: boolean) => void;
  onSnapIndexChange?: (index: number) => void;
  animatedPosition?: SharedValue<number>;
};

/**
 * Gorhom bottom sheet for the map home UI.
 * Host height is locked in pixels so Android keyboard / tab-bar
 * layout churn cannot remeasure the sheet and bounce it.
 */
export function MapBottomSheet({
  children,
  contentContainerStyle,
  onExpandedChange,
  onSnapIndexChange,
  animatedPosition,
}: Props) {
  const sheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(
    () => [
      Math.round(LOCKED_H * 0.48),
      Math.round(LOCKED_H * 0.68),
      Math.round(LOCKED_H * 0.9),
    ],
    [],
  );

  const onChange = useCallback(
    (index: number) => {
      if (index < 0) return;
      onSnapIndexChange?.(index);
      onExpandedChange?.(index >= 2);
    },
    [onExpandedChange, onSnapIndexChange],
  );

  return (
    // Fixed host: gorhom measures this. Must NOT shrink when the window
    // resizes for the keyboard (Expo Go still uses adjustResize).
    <View style={styles.host} pointerEvents="box-none" collapsable={false}>
      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        onChange={onChange}
        animatedPosition={animatedPosition}
        animateOnMount={false}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        enableOverDrag={false}
        enableContentPanningGesture
        // Sheet has no inputs; never chase keyboard (destination owns keypad).
        keyboardBlurBehavior="none"
        android_keyboardInputMode="adjustPan"
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.background}
        style={styles.sheet}
        containerStyle={styles.container}
      >
        <BottomSheetScrollView
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          overScrollMode="never"
        >
          {children}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: LOCKED_H,
    zIndex: 20,
    elevation: 20,
  },
  container: {
    flex: 1,
  },
  sheet: {
    zIndex: 20,
    elevation: 20,
  },
  background: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C8CDCC',
  },
});
