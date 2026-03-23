import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ChevronsLeft, ChevronsRight, Lock, Moon, Sparkles, Sun } from 'lucide-react';
import { cn } from './lib/utils';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { UnifiedInbox } from './components/UnifiedInbox';
import { Timeline } from './components/Timeline';
import { PomodoroTimer } from './components/PomodoroTimer';
import { DragOverlay } from './components/DragOverlay';
import { AtmosphereLayer } from './components/AtmosphereLayer';
import { FocusOverlay } from './components/FocusOverlay';
import { useTheme } from './context/ThemeContext';

const Settings = lazy(() => import('./components/Settings').then((module) => ({ default: module.Settings })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then((module) => ({ default: module.CommandPalette })));
const WeeklyIntentions = lazy(() => import('./components/WeeklyIntentions').then((module) => ({ default: module.WeeklyIntentions })));
const WeeklyPlanningWizard = lazy(() => import('./components/WeeklyPlanningWizard').then((module) => ({ default: module.WeeklyPlanningWizard })));
const MonthlyPlanningWizard = lazy(() => import('./components/MonthlyPlanningWizard').then((module) => ({ default: module.MonthlyPlanningWizard })));
const InkThread = lazy(() => import('./components/Thread').then((module) => ({ default: module.InkThread })));
const MorningBriefing = lazy(() => import('./components/MorningBriefing').then((module) => ({ default: module.MorningBriefing })));
const TodaysFlow = lazy(() => import('./components/TodaysFlow').then((module) => ({ default: module.TodaysFlow })));
const PlanningGuardrails = lazy(() => import('./components/PlanningGuardrails').then((module) => ({ default: module.PlanningGuardrails })));

const ASSISTANT_CLOSE_DELAY_MS = 140;

type LayoutPhase = 'opening' | 'active';

function AppLayout() {
  const [showSettings, setShowSettings] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPinned, setAssistantPinned] = useState(false);
  const [briefingSessionId, setBriefingSessionId] = useState(0);
  const [briefingMode, setBriefingMode] = useState<'briefing' | 'chat'>('briefing');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sourcePanelCollapsed, setSourcePanelCollapsed] = useState(false);
  const [inkStreaming, setInkStreaming] = useState(false);
  const [layoutPhase, setLayoutPhase] = useState<LayoutPhase>('active');
  const [isEveningReflection, setIsEveningReflection] = useState(false);
  const [pendingDayReset, setPendingDayReset] = useState(false);
  const { isFocus } = useTheme();
  const {
    activeView,
    dayLocked,
    focusResumePrompt,
    resumeFocusMode,
    dismissFocusPrompt,
    setActiveView,
    isInitialized,
    unlockDay,
    showEndOfDayPrompt,
    dismissEndOfDayPrompt,
    showStartOfDayPrompt,
    dismissStartOfDayPrompt,
    resetDay,
    isFirstLoadOfDay,
    dayCommitInfo,
  } = useApp();

  const autoBriefingCheckedRef = useRef(false);
  const initializedSourcePanelRef = useRef(false);
  const assistantCloseTimeoutRef = useRef<number | null>(null);

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
    if (showBriefing) return;
    clearAssistantCloseTimeout();
    setActiveView('flow');
    setBriefingMode('chat');
    setAssistantOpen(true);
  }, [clearAssistantCloseTimeout, setActiveView, showBriefing]);

  const scheduleAssistantClose = useCallback(() => {
    if (assistantPinned) return;
    clearAssistantCloseTimeout();
    assistantCloseTimeoutRef.current = window.setTimeout(() => {
      setAssistantOpen(false);
    }, ASSISTANT_CLOSE_DELAY_MS);
  }, [assistantPinned, clearAssistantCloseTimeout]);

  const openPinnedAssistant = useCallback(() => {
    if (showBriefing) return;
    clearAssistantCloseTimeout();
    setActiveView('flow');
    setBriefingMode('chat');
    setAssistantOpen(true);
    setAssistantPinned(true);
  }, [clearAssistantCloseTimeout, setActiveView, showBriefing]);

  const togglePinnedAssistant = useCallback(() => {
    if (assistantPinned) {
      closeAssistant();
      return;
    }
    openPinnedAssistant();
  }, [assistantPinned, closeAssistant, openPinnedAssistant]);

  const openFullscreenInk = useCallback(() => {
    closeAssistant();
    const shouldRunBriefing = dayCommitInfo.state === 'briefing' && !dayCommitInfo.hadBlocks;
    setBriefingMode(shouldRunBriefing ? 'briefing' : 'chat');
    setIsEveningReflection(false);
    setShowBriefing(true);
    setLayoutPhase('opening');
  }, [closeAssistant, dayCommitInfo.hadBlocks, dayCommitInfo.state]);

  const openFullscreenEveningReflection = useCallback(() => {
    closeAssistant();
    setBriefingMode('chat');
    setShowBriefing(true);
    setIsEveningReflection(true);
    setLayoutPhase('opening');
  }, [closeAssistant]);

  const checkAutoBriefing = useCallback(async (isCancelled: () => boolean) => {
    // Show briefing whenever user hasn't committed focus blocks, regardless of time.
    // hasEverCommitted prevents re-triggering after someone clears all blocks.
    if (dayCommitInfo.state !== 'briefing' || dayCommitInfo.hadBlocks) return;

    const key = `briefing.dismissed.${format(new Date(), 'yyyy-MM-dd')}`;
    const [settings, dismissed] = await Promise.all([
      window.api.settings.load(),
      window.api.store.get(key),
    ]);

    if (!isCancelled() && settings.anthropic.configured && !dismissed) {
      openFullscreenInk();
    }
  }, [dayCommitInfo.state, dayCommitInfo.hadBlocks, openFullscreenInk]);

  // Auto-open briefing: before noon, no commits yet, API key configured
  // Gate on isInitialized so dailyPlan reflects the real stored state
  useEffect(() => {
    if (!isInitialized || autoBriefingCheckedRef.current) return;
    autoBriefingCheckedRef.current = true;

    let cancelled = false;
    void checkAutoBriefing(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [isInitialized, checkAutoBriefing]);

  // Weekly planning wizard is opened manually from the sidebar — no auto-open

  const closeBriefing = useCallback(() => {
    const wasEvening = isEveningReflection;
    if (pendingDayReset) {
      void resetDay();
      setPendingDayReset(false);
    }
    setSidebarCollapsed(true);
    setShowBriefing(false);
    setLayoutPhase('active');
    setIsEveningReflection(false);
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
  }, [pendingDayReset, resetDay, isEveningReflection]);

  useEffect(() => {
    return () => {
      clearAssistantCloseTimeout();
    };
  }, [clearAssistantCloseTimeout]);

  // Escape key: close Ink overlay or exit focus lock
  useEffect(() => {
    if (!showBriefing && !assistantPinned && !dayLocked) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (showBriefing) closeBriefing();
      else if (assistantPinned) closeAssistant();
      else if (dayLocked) unlockDay();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showBriefing, assistantPinned, dayLocked, closeBriefing, closeAssistant, unlockDay]);

  useEffect(() => {
    if (!isInitialized || initializedSourcePanelRef.current) return;
    initializedSourcePanelRef.current = true;
    setSourcePanelCollapsed(!isFirstLoadOfDay);
  }, [isFirstLoadOfDay, isInitialized]);

  const isOpening = layoutPhase === 'opening' && showBriefing;
  const dayStarted = dayCommitInfo.state === 'started';
  const sidebarIsCollapsed = isFocus || sidebarCollapsed || dayLocked || showBriefing || dayStarted;
  const sourcePanelAutoCollapsed = isFocus || dayStarted;
  const sourcePanelIsCollapsed = sourcePanelAutoCollapsed || sourcePanelCollapsed;

  return (
    <div
      data-ink-open={showBriefing || assistantOpen ? 'true' : 'false'}
      className={cn(
        'cinematic-shell relative flex h-screen w-full bg-bg text-text-primary font-sans overflow-hidden transition-colors duration-700',
        !showBriefing && !assistantOpen && 'grain'
      )}
    >
      <div className="drag-region" />
      {!isOpening && !showBriefing && <AtmosphereLayer />}

      {/* ═══ OPENING LAYOUT: Ink + compact Timeline ═══ */}
      {isOpening ? (
        <>
          {/* Collapsed sidebar — icon strip only */}
          <Sidebar
            collapsed
            onToggleCollapse={closeBriefing}
            onSettingsClick={() => setShowSettings(true)}
            onShowBriefing={() => {}}
          />
          {isEveningReflection ? (
            <>
              {/* Evening: Today's Plan left, Ink right — review what you did */}
              <div className="flex-1 min-w-0 h-full overflow-hidden border-r border-border-subtle">
                <Suspense fallback={null}>
                  <TodaysFlow />
                </Suspense>
              </div>
              <div className="h-full overflow-hidden" style={{ flex: '1 1 0%', minWidth: 320 }}>
                <Suspense fallback={null}>
                  <MorningBriefing
                    key={briefingSessionId}
                    mode={briefingMode}
                    onClose={closeBriefing}
                    onNewChat={() => setBriefingSessionId((value) => value + 1)}
                    onStreamingChange={setInkStreaming}
                  />
                </Suspense>
              </div>
            </>
          ) : (
            <>
              {/* Morning: Full-width Ink (has its own sidebar) */}
              <div className="flex-1 min-w-0 h-full overflow-hidden">
                <Suspense fallback={null}>
                  <MorningBriefing
                    key={briefingSessionId}
                    mode={briefingMode}
                    onClose={closeBriefing}
                    onNewChat={() => setBriefingSessionId((value) => value + 1)}
                    onStreamingChange={setInkStreaming}
                  />
                </Suspense>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* ═══ ACTIVE LAYOUT: full panels ═══ */}
          <Sidebar
            collapsed={sidebarIsCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
            onSettingsClick={() => setShowSettings(true)}
            onShowBriefing={openFullscreenInk}
            onShowEveningReflection={openFullscreenEveningReflection}
          />
          <div className="flex flex-1 overflow-hidden">
            {activeView === 'flow' && (
              <>
                {/* Inbox collapse toggle */}
                <div className="relative shrink-0 h-full flex">
                  {!sourcePanelAutoCollapsed && sourcePanelCollapsed && (
                    <button
                      onClick={() => setSourcePanelCollapsed(false)}
                      title="Open source list"
                      aria-label="Open source list"
                      className="flex h-full w-10 shrink-0 items-center justify-center border-r border-border-subtle bg-bg text-text-muted transition-colors hover:text-text-primary"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </button>
                  )}
                  <div className={cn(
                    'relative h-full overflow-hidden transition-[width,opacity] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
                    sourcePanelIsCollapsed ? 'w-0 min-w-0 opacity-0 pointer-events-none' : 'w-[280px] opacity-100'
                  )}>
                    {!sourcePanelAutoCollapsed && !sourcePanelCollapsed && (
                      <button
                        onClick={() => setSourcePanelCollapsed(true)}
                        title="Collapse source list"
                        aria-label="Collapse source list"
                        className="absolute right-3 top-3 z-10 rounded-md border border-border-subtle bg-bg-card/90 p-1 text-text-muted backdrop-blur-sm transition-colors hover:text-text-primary"
                      >
                        <ChevronsLeft className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <UnifiedInbox collapsed={sourcePanelIsCollapsed} />
                  </div>
                </div>
                {/* Timeline — center column */}
                <div className="flex-1 min-w-[320px] h-full overflow-hidden">
                  <Timeline />
                </div>
                {/* Guardrails — right column */}
                <Suspense fallback={null}>
                  <PlanningGuardrails onShowBriefing={openPinnedAssistant} />
                </Suspense>
              </>
            )}
            {activeView === 'goals' && (
              <Suspense fallback={null}>
                <WeeklyIntentions />
              </Suspense>
            )}
          </div>
        </>
      )}
      {showSettings && (
        <Suspense fallback={null}>
          <Settings onClose={() => setShowSettings(false)} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <WeeklyPlanningWizard />
      </Suspense>
      <Suspense fallback={null}>
        <MonthlyPlanningWizard />
      </Suspense>
      <DragOverlay />
      <Suspense fallback={null}>
        <InkThread />
      </Suspense>
      {!showBriefing && activeView === 'flow' && (
        <div
          className="absolute bottom-6 right-6 z-40"
          onMouseEnter={openAssistantPreview}
          onMouseLeave={scheduleAssistantClose}
        >
          {assistantOpen && (
            <div
              className={cn(
                'assistant-overlay no-drag absolute bottom-16 right-0 w-[440px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-[28px] border border-[#243041] shadow-[0_28px_80px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-200 ease-out',
                assistantPinned
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-100 translate-y-0'
              )}
            >
              <Suspense fallback={null}>
                <MorningBriefing
                  key={briefingSessionId}
                  mode="chat"
                  variant="overlay"
                  onClose={closeAssistant}
                  onNewChat={() => setBriefingSessionId((value) => value + 1)}
                  onStreamingChange={setInkStreaming}
                />
              </Suspense>
            </div>
          )}
          <button
            onClick={togglePinnedAssistant}
            title={assistantPinned ? 'Close Ink' : 'Open Ink'}
            aria-label={assistantPinned ? 'Close Ink' : 'Open Ink'}
            className={cn(
              'ink-fab no-drag relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg-card/92 text-text-muted shadow-[0_16px_40px_rgba(0,0,0,0.24)] backdrop-blur-md transition-[border-color,color,background-color] hover:border-accent-warm/35 hover:text-accent-warm',
              (inkStreaming || assistantPinned) && 'ink-fab--thinking',
              assistantPinned && 'border-accent-warm/40 bg-bg-elevated/95 text-accent-warm'
            )}
          >
            {inkStreaming && (
              <>
                <span className="ink-fab__ring ink-fab__ring--1" />
                <span className="ink-fab__ring ink-fab__ring--2" />
                <span className="ink-fab__ring ink-fab__ring--3" />
              </>
            )}
            <Sparkles className="ink-fab__icon h-5 w-5" />
          </button>
        </div>
      )}
      <div className="absolute h-px w-px overflow-hidden -left-[9999px] top-0">
        <PomodoroTimer />
      </div>
      <FocusOverlay />
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      {focusResumePrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 rounded-lg border border-border bg-bg-card px-10 py-8 shadow-2xl max-w-sm w-full mx-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Lock className="w-5 h-5 text-[#E55547]/70 mb-1" />
              <p className="font-display text-[22px] text-text-emphasis leading-snug">You left in focus mode.</p>
              <p className="text-[12px] text-text-muted">Resume where you left off, or start a fresh session.</p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={resumeFocusMode}
                className="w-full px-5 py-2.5 bg-[#E55547]/10 hover:bg-[#E55547] text-[#E55547] hover:text-[#FAFAFA] text-[11px] uppercase tracking-[0.18em] font-medium transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Lock className="w-3 h-3" />
                Resume Focus Mode
              </button>
              <button
                onClick={dismissFocusPrompt}
                className="w-full px-5 py-2.5 text-text-muted hover:text-text-primary text-[11px] uppercase tracking-[0.18em] font-medium transition-colors duration-200"
              >
                Start Fresh Session
              </button>
            </div>
          </div>
        </div>
      )}
      {showStartOfDayPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 rounded-lg border border-border bg-bg-card px-10 py-8 shadow-2xl max-w-sm w-full mx-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Sun className="w-5 h-5 text-accent-warm/70 mb-1" />
              <p className="font-display text-[22px] text-text-emphasis leading-snug">Ready to start?</p>
              <p className="text-[12px] text-text-muted">Your workday begin time has arrived.</p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={dismissStartOfDayPrompt}
                className="w-full px-5 py-2.5 bg-accent-warm/10 hover:bg-accent-warm text-accent-warm hover:text-[#FAFAFA] text-[11px] uppercase tracking-[0.18em] font-medium transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Sun className="w-3 h-3" />
                Let's Go
              </button>
              <button
                onClick={dismissStartOfDayPrompt}
                className="w-full px-5 py-2.5 text-text-muted hover:text-text-primary text-[11px] uppercase tracking-[0.18em] font-medium transition-colors duration-200"
              >
                Not Yet
              </button>
            </div>
          </div>
        </div>
      )}
      {showEndOfDayPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-6 rounded-lg border border-border bg-bg-card px-10 py-8 shadow-2xl max-w-sm w-full mx-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <Moon className="w-5 h-5 text-accent-warm/70 mb-1" />
              <p className="font-display text-[22px] text-text-emphasis leading-snug">That's a wrap.</p>
              <p className="text-[12px] text-text-muted">Your workday end time has arrived. Time to close out or keep going.</p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => { setPendingDayReset(true); dismissEndOfDayPrompt(); dismissStartOfDayPrompt(); openFullscreenEveningReflection(); }}
                className="w-full px-5 py-2.5 bg-accent-warm/10 hover:bg-accent-warm text-accent-warm hover:text-[#FAFAFA] text-[11px] uppercase tracking-[0.18em] font-medium transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Moon className="w-3 h-3" />
                End the Day
              </button>
              <button
                onClick={() => { dismissEndOfDayPrompt(); dismissStartOfDayPrompt(); }}
                className="w-full px-5 py-2.5 text-text-muted hover:text-text-primary text-[11px] uppercase tracking-[0.18em] font-medium transition-colors duration-200"
              >
                Keep Going
              </button>
            </div>
          </div>
        </div>
      )}
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
