import { useCallback, useState } from 'react';
import { Platform, RefreshControl } from 'react-native';
import { color } from '@/theme/brand';

export function usePullToRefresh(onRefresh: () => void | Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  const control = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => { void refresh(); }}
      tintColor={color.brand}
      colors={[color.brand]}
      progressBackgroundColor={Platform.OS === 'android' ? color.surface : undefined}
    />
  );

  return { refreshing, refresh, control };
}
