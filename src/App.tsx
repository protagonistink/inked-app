import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { cn } from './lib/utils';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { DragOverlay } from './components/DragOverlay';
import { AtmosphereLayer } from './components/AtmosphereLayer';
import { BriefingMode } from './modes/BriefingMode';
import { PlanningMode } from './modes/PlanningMode';
import { ExecutingMode } from './modes/ExecutingMode';
import { FocusMode } from './modes/FocusMode';

const Settings = lazy(() => import('./components/Settings').then((m) => ({ default: m.Settings })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));
const InkThread = lazy(() => import('./components/Thread').then((m) => ({ default: m.InkThread })));
const IntentionsView = lazy(() => import('./components/intentions/IntentionsView').then((m) => ({ default: m.IntentionsView })));

const ASSISTANT_CLOSE_DELAY_MS = 140;

function AppLayout() {
  const {
    mode,
    view,
    focusTaskId,
    completeBriefing,
    startDay,
    enterFocus,
    exitFocus,
    openInbox,
    isInitialized,
    dayCommitInfo,
    resetDay,
  } = useApp();

  // --- Local UI state ---
  const [showSettings, setShowSettings] = useState(false);
  const [isEveningReflection, setIsEveningReflection] = useState(false);
  const [pendingDayReset, setPendingDayReset] = useState(false);
  const [briefingSessionId, setBriefingSessionId] = useState(0);
  const [briefingMode, setBriefingMode] = useState<'briefing' | 'chat'>('briefing');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPinned, setAssistantPinned] = useState(false);
  const [inkStreaming, setInkStreaming] = useState(false);

  const autoBriefingCheckedRef = useRef(false);
  const assistantCloseTimeoutRef = useRef<number | null>(null);

  // --- Ink assistant helpers ---
  const clearAssistantCloseTimeout = useCallback(() => {
    if (assistantCloseTimeoutRef.current !== null) {
      window.clearTimeout(assistantCloseTimeoutRef.current);
      assistantCloseTimeoutRef.current = null;
    }
  }, []);

  const closeAssistant = useCallback(() => {
    clearAssistantCloseTimeout();
    setAssistantPinned(false);
    setAssistantOpen(false);
  }, [clearAssistantCloseTimeout]);

  const openAssistantPreview = useCallback(() => {
    if (mode === 'briefing') return;
    clearAssistantCloseTimeout();
    setBriefingMode('chat');
    setAssistantOpen(true);
  }, [clearAssistantCloseTimeout, mode]);

  const scheduleAssistantClose = useCallback(() => {
    if (assistantPinned) return;
    clearAssistantCloseTimeout();
    assistantCloseTimeoutRef.current = window.setTimeout(() => {
      setAssistantOpen(false);
    }, ASSISTANT_CLOSE_DELAY_MS);
  }, [assistantPinned, clearAssistantCloseTimeout]);

  const togglePinnedAssistant = useCallback(() => {
    if (assistantPinned) {
      closeAssistant();
      return;
    }
    if (mode === 'briefing') return;
    clearAssistantCloseTimeout();
    setBriefingMode('chat');
    setAssistantOpen(true);
    setAssistantPinned(true);
  }, [assistantPinned, closeAssistant, clearAssistantCloseTimeout, mode]);

  // --- Fullscreen Ink / briefing ---
  const openFullscreenInk = useCallback(() => {
    closeAssistant();
    const shouldRunBriefing = dayCommitInfo.state === 'briefing' && !dayCommitInfo.hadBlocks;
    setBriefingMode(shouldRunBriefing ? 'briefing' : 'chat');
    setIsEveningReflection(false);
  }, [closeAssistant, dayCommitInfo.hadBlocks, dayCommitInfo.state]);

  const openEveningReflection = useCallback(() => {
    closeAssistant();
    setBriefingMode('chat');
    setIsEveningReflection(true);
  }, [closeAssistant]);

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
      // No API key — skip briefing, go straight to planning
      completeBriefing();
    }
  }, [dayCommitInfo.state, dayCommitInfo.hadBlocks, openFullscreenInk, completeBriefing]);

  useEffect(() => {
    if (!isInitialized || autoBriefingCheckedRef.current) return;
    autoBriefingCheckedRef.current = true;

    let cancelled = false;
    void checkAutoBriefing(() => cancelled);

    return () => { cancelled = true; };
  }, [isInitialized, checkAutoBriefing]);

  // --- Close briefing ---
  const closeBriefing = useCallback(() => {
    const wasEvening = isEveningReflection;
    if (pendingDayReset) {
      void resetDay();
      setPendingDayReset(false);
    }
    setIsEveningReflection(false);
    completeBriefing();
    window.api.store.set(`briefing.dismissed.${format(new Date(), 'yyyy-MM-dd')}`, true);

    // Generate and save evening reflection from today's conversation
    if (wasEvening) {
      const today = format(new Date(), 'yyyy-MM-dd');
      void window.api.chat.load(today).then((msgs) => {
        if (msgs.length < 2) return;
        const transcript = msgs.map((m) => `${m.role}: ${m.content}`).join('\n').slice(0, 2000);
        void window.api.ai.chat(
          [{ role: 'user', content: `Summarize this end-of-day conversation in 1-2 sentences as a carry-forward note for tomorrow morning. Focus on what landed, what slipped, and any decisions made. Be concise and factual.\n\n${transcript}` }],
          {} as any
        ).then((res) => {
          if (!res.success || !res.content) return;
          void window.api.ink.readContext().then((ctx) => {
            const entry = ctx.journalEntries?.find((e) => e.date === today);
            if (entry) {
              entry.eveningReflection = res.content!;
              void window.api.ink.appendJournal(entry);
            }
          });
        });
      });
    }
  }, [pendingDayReset, resetDay, isEveningReflection, completeBriefing]);

  // --- Escape key ---
  useEffect(() => {
    if (mode !== 'briefing' && !assistantPinned) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (mode === 'briefing') closeBriefing();
      else if (assistantPinned) closeAssistant();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mode, assistantPinned, closeBriefing, closeAssistant]);

  // Cleanup timeout on unmount
  useEffect(() => () => clearAssistantCloseTimeout(), [clearAssistantCloseTimeout]);

  const showInkOverlay = mode === 'briefing';

  return (
    <div
      data-ink-open={showInkOverlay || assistantOpen ? 'true' : 'false'}
      className={cn(
        'cinematic-shell relative flex h-screen w-full bg-bg text-text-primary font-sans overflow-hidden transition-colors duration-700',
        !showInkOverlay && !assistantOpen && 'grain'
      )}
    >
      <div className="drag-region" />
      {!showInkOverlay && <AtmosphereLayer />}

      {/* ═══ MODE ROUTER ═══ */}
      {view === 'intentions' ? (
        <Suspense fallback={null}>
          <IntentionsView />
        </Suspense>
      ) : mode === 'briefing' ? (
        <BriefingMode
          onComplete={closeBriefing}
          onSettings={() => setShowSettings(true)}
          isEvening={isEveningReflection}
          briefingSessionId={briefingSessionId}
          onNewChat={() => setBriefingSessionId((n) => n + 1)}
          onStreamingChange={setInkStreaming}
          briefingMode={briefingMode}
        />
      ) : mode === 'focus' && focusTaskId ? (
        <FocusMode taskId={focusTaskId} onExit={exitFocus} />
      ) : mode === 'planning' ? (
        <PlanningMode
          onStartDay={startDay}
          onOpenInk={openFullscreenInk}
          onSettings={() => setShowSettings(true)}
          onEndDay={() => { setPendingDayReset(true); openEveningReflection(); }}
          assistantOpen={assistantOpen}
          assistantPinned={assistantPinned}
          onAssistantHover={openAssistantPreview}
          onAssistantLeave={scheduleAssistantClose}
          onToggleAssistant={togglePinnedAssistant}
          inkStreaming={inkStreaming}
          briefingSessionId={briefingSessionId}
          onNewChat={() => setBriefingSessionId((n) => n + 1)}
          onStreamingChange={setInkStreaming}
        />
      ) : (
        <ExecutingMode
          onEnterFocus={enterFocus}
          onOpenInk={openFullscreenInk}
          onOpenInbox={openInbox}
          onSettings={() => setShowSettings(true)}
          onEndDay={() => { setPendingDayReset(true); openEveningReflection(); }}
          assistantOpen={assistantOpen}
          assistantPinned={assistantPinned}
          onAssistantHover={openAssistantPreview}
          onAssistantLeave={scheduleAssistantClose}
          onToggleAssistant={togglePinnedAssistant}
          inkStreaming={inkStreaming}
          briefingSessionId={briefingSessionId}
          onNewChat={() => setBriefingSessionId((n) => n + 1)}
          onStreamingChange={setInkStreaming}
        />
      )}

      {/* ═══ GLOBAL OVERLAYS ═══ */}
      {showSettings && (
        <Suspense fallback={null}>
          <Settings onClose={() => setShowSettings(false)} />
        </Suspense>
      )}
      <DragOverlay />
      <Suspense fallback={null}>
        <InkThread />
      </Suspense>
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <DndProvider backend={HTML5Backend}>
          <AppLayout />
        </DndProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
