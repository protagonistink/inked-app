import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from './lib/utils';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { InkAssistantProvider, useInkAssistant } from './context/InkAssistantContext';
import { DragOverlay } from './components/shared/DragOverlay';
import { ErrorBoundary, RootFallback, ModeFallback } from './components/shared/ErrorBoundary';
import { AtmosphereLayer } from './components/AtmosphereLayer';
import { Sidebar } from './components/chrome/Sidebar';
import { BriefingMode } from './modes/BriefingMode';
import { PlanningMode } from './modes/PlanningMode';
import { ExecutingMode } from './modes/ExecutingMode';
import { FocusMode } from './modes/FocusMode';

const Settings = lazy(() => import('./components/chrome/Settings').then((m) => ({ default: m.Settings })));
const CommandPalette = lazy(() => import('./components/chrome/CommandPalette').then((m) => ({ default: m.CommandPalette })));
const InkThread = lazy(() => import('./components/ink/Thread').then((m) => ({ default: m.InkThread })));
const IntentionsView = lazy(() => import('./components/intentions/IntentionsView').then((m) => ({ default: m.IntentionsView })));

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
    setView,
    setViewDate,
    resetAppMode,
  } = useApp();

  const {
    assistantOpen,
    assistantPinned,
    closeAssistant,
    setBriefingMode,
  } = useInkAssistant();

  // --- Local UI state ---
  const [showSettings, setShowSettings] = useState(false);
  const [isEveningReflection, setIsEveningReflection] = useState(false);
  const [pendingDayReset, setPendingDayReset] = useState(false);

  const autoBriefingCheckedRef = useRef(false);

  // --- Fullscreen Ink / briefing ---
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
      }).finally(() => {
        void window.api.chat.clear(today);
      });
      return;
    }
    void window.api.chat.clear(today);
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

  // --- View hotkeys ---
  useEffect(() => {
    function handleViewHotkeys(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === '1') {
        setView('flow');
      } else if (e.key === '2') {
        setView('intentions');
      }
    }

    document.addEventListener('keydown', handleViewHotkeys);
    return () => document.removeEventListener('keydown', handleViewHotkeys);
  }, [setView]);

  // --- Native menu bar events ---
  useEffect(() => {
    const cleanups = [
      window.api.menu.onSetView((v) => setView(v as import('./types/appMode').View)),
      window.api.menu.onOpenSettings(() => setShowSettings(true)),
      window.api.menu.onOpenInk(() => openFullscreenInk()),
      window.api.menu.onStartDay(() => startDay()),
      window.api.menu.onGoToday(() => setViewDate(new Date())),
    ];
    return () => cleanups.forEach((fn) => fn());
  }, [setView, openFullscreenInk, startDay, setViewDate]);

  const showInkOverlay = mode === 'briefing';

  const modeFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <ModeFallback error={error} resetErrorBoundary={resetErrorBoundary} />
  );

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

      {mode !== 'focus' && (
        <Sidebar onSettingsClick={() => setShowSettings(true)} />
      )}

      <div className={cn('flex flex-1 overflow-hidden', mode !== 'focus' && 'ml-12')}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${mode}-${view}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex-1 flex overflow-hidden"
          >
            {view === 'intentions' ? (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <Suspense fallback={null}>
                  <IntentionsView />
                </Suspense>
              </ErrorBoundary>
            ) : mode === 'briefing' ? (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <BriefingMode
                  onComplete={closeBriefing}
                  isEvening={isEveningReflection}
                />
              </ErrorBoundary>
            ) : mode === 'focus' && focusTaskId ? (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <FocusMode taskId={focusTaskId} onExit={exitFocus} />
              </ErrorBoundary>
            ) : mode === 'planning' ? (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <PlanningMode
                  onStartDay={startDay}
                  onOpenInk={openFullscreenInk}
                  onEndDay={() => { setPendingDayReset(true); openEveningReflection(); }}
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <ExecutingMode
                  onEnterFocus={enterFocus}
                  onOpenInk={openFullscreenInk}
                  onOpenInbox={openInbox}
                  onEndDay={() => { setPendingDayReset(true); openEveningReflection(); }}
                />
              </ErrorBoundary>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

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
        <CommandPalette onOpenSettings={() => setShowSettings(true)} onOpenInk={openFullscreenInk} />
      </Suspense>
    </div>
  );
}

function AppLayoutWithInk() {
  const { mode } = useApp();
  return (
    <InkAssistantProvider mode={mode}>
      <ErrorBoundary fallback={({ error }) => <RootFallback error={error} />}>
        <AppLayout />
      </ErrorBoundary>
    </InkAssistantProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <DndProvider backend={HTML5Backend}>
          <AppLayoutWithInk />
        </DndProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
