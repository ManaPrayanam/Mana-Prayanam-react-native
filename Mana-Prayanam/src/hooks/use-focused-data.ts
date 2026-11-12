import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { errorMessage } from '@/api/client';

export function useFocusedData<T>(load: () => Promise<T>, interval?: number) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const refreshCurrent = useRef<(() => Promise<void>) | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const result = await load();
        if (active) {
          setData(result);
          setError('');
        }
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      } finally {
        pending = false;
      }
    }
    refreshCurrent.current = refresh;
    void refresh();
    const timer = interval ? setInterval(refresh, interval) : undefined;
    return () => {
      active = false;
      refreshCurrent.current = null;
      clearInterval(timer);
    };
  }, [load, interval]));

  return { data, error, refresh: () => { void refreshCurrent.current?.(); } };
}
