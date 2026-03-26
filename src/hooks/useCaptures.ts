import { useState, useEffect, useCallback } from 'react';
import type { CaptureEntry } from '@/types';

export function useCaptures() {
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);

  const refresh = useCallback(async () => {
    const list = await window.api.capture.list();
    setCaptures(list);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCapture = useCallback(async (text: string) => {
    await window.api.capture.add(text);
    await refresh();
  }, [refresh]);

  const removeCapture = useCallback(async (id: string) => {
    await window.api.capture.remove(id);
    await refresh();
  }, [refresh]);

  return { captures, addCapture, removeCapture, refresh };
}
