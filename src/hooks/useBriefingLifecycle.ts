import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useAppShell, useAppStatus } from '@/context/AppContext';
import { useInkAssistant } from '@/context/InkAssistantContext';
import { buildMinimalContext } from '@/lib/briefingContext';
import type { SafeStoreKey } from '@/types/electron';

export function useBriefingLifecycle() {
  const { completeBriefing, startDay, openBriefing } = useAppShell();
  const {
    isInitialized,
    dayCommitInfo,
    resetDay,
  } = useAppStatus();

  const { activeThreadId, closeAssistant, openPlanningChat } = useInkAssistant();

  const [isEveningReflection, setIsEveningReflection] = useState(false);
  const [pendingDayReset, setPendingDayReset] = useState(false);
  const autoBriefingCheckedRef = useRef(false);

  const openFullscreenInk = useCallback(() => {
    closeAssistant();
    openBriefing();
    openPlanningChat();
    setIsEveningReflection(false);
  }, [closeAssistant, openBriefing, openPlanningChat]);

  const openEveningReflection = useCallback(() => {
    closeAssistant();
    openBriefing();
    openPlanningChat();
    setIsEveningReflection(true);
  }, [closeAssistant, openBriefing, openPlanningChat]);

  const requestDayReset = useCallback(() => {
    setPendingDayReset(true);
    openEveningReflection();
  }, [openEveningReflection]);

  // --- Auto-briefing check ---
  const checkAutoBriefing = useCallback(async (isCancelled: () => boolean) => {
    if (dayCommitInfo.state !== 'briefing' || dayCommitInfo.hadBlocks) return;

    const key = `briefing.dismissed.${format(new Date(), 'yyyy-MM-dd')}` as SafeStoreKey;
    const [settings, dismissed] = await Promise.all([
      window.api.settings.load(),
      window.api.store.get(key),
    ]);

    if (!isCancelled() && settings.anthropic.configured && !dismissed) {
      openFullscreenInk();
    } else if (!isCancelled() && !settings.anthropic.configured) {
      completeBriefing();
    }
  }, [dayCommitInfo.state, dayCommitInfo.hadBlocks, openFullscreenInk, completeBriefing]);

  // Track the current date so we can detect midnight rollover
  const currentDateRef = useRef(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!isInitialized || autoBriefingCheckedRef.current) return;
    autoBriefingCheckedRef.current = true;
    // Clear old days' conversations (keeps today's intact)
    void window.api.chat.clearOld(format(new Date(), 'yyyy-MM-dd'));

    let cancelled = false;
    void checkAutoBriefing(() => cancelled);

    return () => { cancelled = true; };
  }, [isInitialized, checkAutoBriefing]);

  // Detect midnight rollover: clear stale conversation when the date changes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = format(new Date(), 'yyyy-MM-dd');
      if (now !== currentDateRef.current) {
        currentDateRef.current = now;
        void window.api.chat.clearOld(now);
      }
    }, 60_000); // check every minute
    return () => clearInterval(interval);
  }, []);

  // --- Close briefing ---
  const closeBriefing = useCallback(() => {
    const wasEvening = isEveningReflection;
    const today = format(new Date(), 'yyyy-MM-dd');
    if (pendingDayReset) {
      void resetDay();
      setPendingDayReset(false);
    }
    setIsEveningReflection(false);
    completeBriefing();
    startDay();
    window.api.store.set(`briefing.dismissed.${today}`, true);

    if (wasEvening) {
      void generateEveningReflection(today, activeThreadId);
      return;
    }
  }, [activeThreadId, pendingDayReset, resetDay, isEveningReflection, completeBriefing, startDay]);

  return {
    isEveningReflection,
    openFullscreenInk,
    requestDayReset,
    closeBriefing,
  };
}

async function generateEveningReflection(today: string, threadId: string | null) {
  if (!threadId) return;
  const thread = await window.api.chat.loadThread(threadId);
  const msgs = thread?.messages ?? [];
  if (msgs.length < 2) return;

  const transcript = msgs.map((m) => `${m.role}: ${m.content}`).join('\n').slice(0, 2000);
  const res = await window.api.ai.chat(
    [{ role: 'user', content: `Summarize this end-of-day conversation in 1-2 sentences as a carry-forward note for tomorrow morning. Focus on what landed, what slipped, and any decisions made. Be concise and factual.\n\n${transcript}` }],
    buildMinimalContext()
  );

  if (!res.success || !res.content) return;

  const ctx = await window.api.ink.readContext();
  const entry = ctx.journalEntries?.find((e) => e.date === today);
  if (entry) {
    entry.eveningReflection = res.content;
    await window.api.ink.appendJournal(entry);
  }
}
