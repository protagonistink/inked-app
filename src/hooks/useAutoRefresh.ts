import { useEffect } from 'react';

interface AutoRefreshOptions {
  enabled: boolean;
  intervalMs: number;
  refresh: () => Promise<void>;
}

export function useAutoRefresh({ enabled, intervalMs, refresh }: AutoRefreshOptions) {
  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;

    const intervalId = window.setInterval(() => {
      void refresh();
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [enabled, intervalMs, refresh]);
}
