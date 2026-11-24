import { StyleSheet, Text, View } from 'react-native';
import { color } from '@/theme/brand';

export type PayIconKind = 'Cash' | 'UPI' | 'Card';

/** Brand-colored payment marks using app green + amber. */
export function PayIcon({ kind, size = 22 }: { kind: PayIconKind; size?: number }) {
  if (kind === 'UPI') {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <View style={styles.upiBars}>
          <View style={[styles.upiBar, { backgroundColor: color.brand, height: size * 0.55 }]} />
          <View style={[styles.upiBar, { backgroundColor: color.amber, height: size * 0.7 }]} />
          <View style={[styles.upiBar, { backgroundColor: '#E87722', height: size * 0.45 }]} />
        </View>
        <Text style={[styles.upiText, { fontSize: Math.max(7, size * 0.28) }]}>UPI</Text>
      </View>
    );
  }

  if (kind === 'Card') {
    return (
      <View
        style={[
          styles.card,
          {
            width: size * 1.25,
            height: size * 0.85,
            borderRadius: size * 0.12,
          },
        ]}
      >
        <View style={[styles.cardStripe, { top: size * 0.2, height: size * 0.18 }]} />
        <View style={[styles.cardChip, { width: size * 0.28, height: size * 0.16, bottom: size * 0.14 }]} />
        <View style={[styles.cardDot, { width: size * 0.12, height: size * 0.12, right: size * 0.12 }]} />
      </View>
    );
  }

  // Cash
  return (
    <View
      style={[
        styles.cash,
        {
          width: size * 1.15,
          height: size * 0.78,
          borderRadius: size * 0.1,
        },
      ]}
    >
      <View style={[styles.cashInner, { borderRadius: size * 0.06 }]}>
        <View
          style={[
            styles.cashCoin,
            {
              width: size * 0.38,
              height: size * 0.38,
              borderRadius: size * 0.19,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  upiBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: '70%',
  },
  upiBar: {
    width: 4,
    borderRadius: 1,
    transform: [{ skewX: '-12deg' }],
  },
  upiText: {
    fontWeight: '800',
    color: color.ink,
    letterSpacing: 0.3,
    lineHeight: 10,
  },
  card: {
    backgroundColor: color.brand,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    paddingHorizontal: 3,
  },
  cardStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: color.amber,
  },
  cardChip: {
    backgroundColor: '#E8F6EE',
    borderRadius: 2,
    marginBottom: 2,
  },
  cardDot: {
    position: 'absolute',
    top: 3,
    backgroundColor: color.amberTint,
    borderRadius: 99,
  },
  cash: {
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  cashInner: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: color.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cashCoin: {
    backgroundColor: color.amber,
    borderWidth: 2,
    borderColor: color.brand,
  },
});
