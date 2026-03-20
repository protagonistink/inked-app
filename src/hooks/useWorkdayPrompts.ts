import { useCallback, useEffect, useRef, useState } from 'react';

interface WorkdayPromptsOptions {
  isInitialized: boolean;
  workdayStartMinutes: number;
  workdayEndMinutes: number;
  initialStartShownDate: string | null;
  initialEndShownDate: string | null;
  initialIsFirstLoadOfDay: boolean;
}

interface WorkdayPromptsResult {
  showStartOfDayPrompt: boolean;
  showEndOfDayPrompt: boolean;
  isFirstLoadOfDay: boolean;
  dismissStartOfDayPrompt: () => void;
  dismissEndOfDayPrompt: () => void;
}

export function useWorkdayPrompts({
  isInitialized,
  workdayStartMinutes,
  workdayEndMinutes,
  initialStartShownDate,
  initialEndShownDate,
  initialIsFirstLoadOfDay,
}: WorkdayPromptsOptions): WorkdayPromptsResult {
  const [showStartOfDayPrompt, setShowStartOfDayPrompt] = useState(false);
  const [showEndOfDayPrompt, setShowEndOfDayPrompt] = useState(false);
  const [isFirstLoadOfDay, setIsFirstLoadOfDay] = useState(initialIsFirstLoadOfDay);

  const hasShownStartOfDayRef = useRef(false);
  const hasShownEndOfDayRef = useRef(false);
  const startOfDayShownDateRef = useRef<string | null>(initialStartShownDate);
  const endOfDayShownDateRef = useRef<string | null>(initialEndShownDate);

  // Start-of-day prompt: fire once per calendar day when time crosses workdayStart.
  // BUG FIX: Do NOT reset hasShownStartOfDayRef on workdayStartMinutes change.
  // The date guard (startOfDayShownDateRef.current === today) is sufficient.
  useEffect(() => {
    if (!isInitialized) return;
    let previousMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    const check = () => {
      if (hasShownStartOfDayRef.current) return;
      const today = new Date().toISOString().split('T')[0];
      if (startOfDayShownDateRef.current === today) return;
      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      const crossedStartBoundary =
        previousMinutes < workdayStartMinutes && nowMinutes >= workdayStartMinutes;
      previousMinutes = nowMinutes;
      if (crossedStartBoundary) {
        hasShownStartOfDayRef.current = true;
        startOfDayShownDateRef.current = today;
        setIsFirstLoadOfDay(false);
        void window.api.store.set('startOfDay.shownDate', today);
        setShowStartOfDayPrompt(true);
        void window.api.window.showMain();
      }
    };

    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [isInitialized, workdayStartMinutes]);

  // End-of-day prompt: fire once per calendar day when time crosses workdayEnd.
  // BUG FIX: Do NOT reset hasShownEndOfDayRef on workdayEndMinutes change.
  useEffect(() => {
    if (!isInitialized) return;

    const check = () => {
      if (hasShownEndOfDayRef.current) return;
      const today = new Date().toISOString().split('T')[0];
      if (endOfDayShownDateRef.current === today) return;
      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      if (nowMinutes >= workdayEndMinutes) {
        hasShownEndOfDayRef.current = true;
        endOfDayShownDateRef.current = today;
        void window.api.store.set('endOfDay.shownDate', today);
        setShowStartOfDayPrompt(false);
        setShowEndOfDayPrompt(true);
        void window.api.window.showMain();
      }
    };

    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [isInitialized, workdayEndMinutes]);

  const dismissStartOfDayPrompt = useCallback(() => {
    setIsFirstLoadOfDay(false);
    setShowStartOfDayPrompt(false);
  }, []);

  const dismissEndOfDayPrompt = useCallback(() => setShowEndOfDayPrompt(false), []);

  return {
    showStartOfDayPrompt,
    showEndOfDayPrompt,
    isFirstLoadOfDay,
    dismissStartOfDayPrompt,
    dismissEndOfDayPrompt,
  };
}
