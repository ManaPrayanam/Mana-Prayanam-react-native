import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import NativeWebView from 'react-native-webview';
import { ARRIVE_SOUND_DATA_URI } from '@/components/arrive-sound-data';

const WebView = NativeWebView as unknown as ComponentType<{
  source: { html: string };
  originWhitelist: string[];
  style?: object;
  scrollEnabled?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  allowsInlineMediaPlayback?: boolean;
}>;

/** Plays arrival chime via HTML5 audio (works without expo-av native module). */
export function ArriveSound({ playKey }: { playKey: number }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!playKey) return;
    setMounted(true);
    const t = setTimeout(() => setMounted(false), 2500);
    return () => clearTimeout(t);
  }, [playKey]);

  const html = useMemo(
    () => `<!doctype html><html><head><meta charset="utf-8"/></head><body>
<script>
(function () {
  try {
    var a = new Audio(${JSON.stringify(ARRIVE_SOUND_DATA_URI)});
    a.volume = 1;
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
  } catch (e) {}
})();
</script>
</body></html>`,
    [],
  );

  if (!mounted) return null;

  return (
    <View style={styles.hidden} pointerEvents="none">
      <WebView
        key={playKey}
        source={{ html }}
        originWhitelist={['*']}
        scrollEnabled={false}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        style={styles.hidden}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { width: 1, height: 1, opacity: 0, position: 'absolute', left: -20, top: -20 },
});
