import { Image, StyleSheet } from 'react-native';

export function BrandLogo({ size = 144 }: { size?: number }) {
  return <Image accessibilityLabel="Mana Prayanam" source={require('@/assets/images/mana-logo.png')}
    resizeMode="contain" style={[styles.logo, { width: size, height: size }]} />;
}

const styles = StyleSheet.create({ logo: { alignSelf: 'center', borderRadius: 16 } });
