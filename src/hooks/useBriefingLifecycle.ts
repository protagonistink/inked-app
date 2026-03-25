import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { useInkAssistant } from '@/context/InkAssistantContext';

export function useBriefingLifecycle() {
  const {
    completeBriefing,
    isInitialized,
    dayCommitInfo,
    resetDay,
  } = useApp();

  const { closeAssistant, setBriefingMode } = useInkAssistant();

  const [isEveningReflection, setIsEveningReflection] = useState(false);
  const [pendingDayReset, setPendingDayReset] = useState(false);
  const autoBriefingCheckedRef = useRef(false);

  const openFullscreenInk = useCallback(() => {
    closeAssistant();
    const shouldRunBriefing = dayCommitInfo.state === 'briefing' && !dayCommitInfo.hadBlocks;
    setBriefingMode(shouldRunBriefing ? 'briefing' : 'chat');
    setIsEveningReflection(false);
  }, [closeAssistant, setBriefingMode, dayCommitInfo.hadBlocks, dayCommitInfo.state]);

  const openEveningReflection = useCallback(() => {
    closeAssistant();
    setBriefingMode('chat');
    setIsEveningReflection(true);
  }, [closeAssistant, setBriefingMode]);

  const requestDayReset = useCallback(() => {
    setPendingDayReset(true);
    openEveningReflection();
  }, [openEveningReflection]);

  // --- Auto-briefing check ---
  const checkAutoBriefing = useCallback(async (isCancelled: () => boolean) => {
    if (dayCommitInfo.state !== 'briefing' || dayCommitInfo.hadBlocks) return;

    const key = `briefing.dismissed.${format(new Date(), 'yyyy-MM-dd')}`;
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

  useEffect(() => {
    if (!isInitialized || autoBriefingCheckedRef.current) return;
    autoBriefingCheckedRef.current = true;
    void window.api.chat.clear(format(new Date(), 'yyyy-MM-dd'));

    let cancelled = false;
    void checkAutoBriefing(() => cancelled);

    return () => { cancelled = true; };
  }, [isInitialized, checkAutoBriefing]);

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
    window.api.store.set(`briefing.dismissed.${today}`, true);

    if (wasEvening) {
      void generateEveningReflection(today);
      return;
    }
    void window.api.chat.clear(today);
  }, [pendingDayReset, resetDay, isEveningReflection, completeBriefing]);

  return {
    isEveningReflection,
    openFullscreenInk,
    requestDayReset,
    closeBriefing,
  };
}

async function generateEveningReflection(today: string) {
  try {
    const msgs = await window.api.chat.load(today);
    if (msgs.length < 2) return;

    const transcript = msgs.map((m) => `${m.role}: ${m.content}`).join('\n').slice(0, 2000);
    const res = await window.api.ai.chat(
      [{ role: 'user', content: `Summarize this end-of-day conversation in 1-2 sentences as a carry-forward note for tomorrow morning. Focus on what landed, what slipped, and any decisions made. Be concise and factual.\n\n${transcript}` }],
      {} as any
    );

    if (!res.success || !res.content) return;

    const ctx = await window.api.ink.readContext();
    const entry = ctx.journalEntries?.find((e) => e.date === today);
    if (entry) {
      entry.eveningReflection = res.content;
      await window.api.ink.appendJournal(entry);
    }
  } finally {
    void window.api.chat.clear(today);
  }
}
