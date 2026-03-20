import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Countdown, DailyRitual } from '@/types';
import { getToday } from '@/lib/planner';

interface CollectionActionsOptions {
  setRituals: Dispatch<SetStateAction<DailyRitual[]>>;
  setCountdowns: Dispatch<SetStateAction<Countdown[]>>;
}

interface CollectionActionsResult {
  addRitual: (title: string) => void;
  removeRitual: (id: string) => void;
  toggleRitualComplete: (id: string) => void;
  updateRitualEstimate: (id: string, mins: number) => void;
  addCountdown: (title: string, dueDate: string) => void;
  removeCountdown: (id: string) => void;
}

export function useCollectionActions({
  setRituals,
  setCountdowns,
}: CollectionActionsOptions): CollectionActionsResult {
  const addRitual = useCallback((title: string) => {
    if (!title.trim()) return;
    setRituals((prev) => [
      ...prev,
      { id: `ritual-${Date.now()}`, title: title.trim(), completedDates: [] },
    ]);
  }, [setRituals]);

  const removeRitual = useCallback((id: string) => {
    setRituals((prev) => prev.filter((r) => r.id !== id));
  }, [setRituals]);

  const toggleRitualComplete = useCallback((id: string) => {
    const today = getToday();
    setRituals((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const already = r.completedDates.includes(today);
        return {
          ...r,
          completedDates: already
            ? r.completedDates.filter((d) => d !== today)
            : [...r.completedDates, today],
        };
      })
    );
  }, [setRituals]);

  const updateRitualEstimate = useCallback((id: string, mins: number) => {
    setRituals((prev) => prev.map((r) => (r.id === id ? { ...r, estimateMins: mins } : r)));
  }, [setRituals]);

  const addCountdown = useCallback((title: string, dueDate: string) => {
    if (!title.trim() || !dueDate) return;
    setCountdowns((prev) => [
      ...prev,
      { id: `countdown-${Date.now()}`, title: title.trim(), dueDate },
    ]);
  }, [setCountdowns]);

  const removeCountdown = useCallback((id: string) => {
    setCountdowns((prev) => prev.filter((c) => c.id !== id));
  }, [setCountdowns]);

  return {
    addRitual,
    removeRitual,
    toggleRitualComplete,
    updateRitualEstimate,
    addCountdown,
    removeCountdown,
  };
}
