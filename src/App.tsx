import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { DndProvider, useDragLayer } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Lock, Moon, Sparkles, Sun } from 'lucide-react';
import { cn } from './lib/utils';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { UnifiedInbox } from './components/UnifiedInbox';
import { TodaysFlow } from './components/TodaysFlow';
import { Timeline } from './components/Timeline';
import { PomodoroTimer } from './components/PomodoroTimer';
import { DragOverlay } from './components/DragOverlay';
import { AtmosphereLayer } from './components/AtmosphereLayer';
import { useTheme } from './context/ThemeContext';

const Settings = lazy(() => import('./components/Settings').then((module) => ({ default: module.Settings })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then((module) => ({ default: module.CommandPalette })));
const WeeklyIntentions = lazy(() => import('./components/WeeklyIntentions').then((module) => ({ default: module.WeeklyIntentions })));
const WeeklyPlanningWizard = lazy(() => import('./components/WeeklyPlanningWizard').then((module) => ({ default: module.WeeklyPlanningWizard })));
const MonthlyPlanningWizard = lazy(() => import('./components/MonthlyPlanningWizard').then((module) => ({ default: module.MonthlyPlanningWizard })));
const InkThread = lazy(() => import('./components/Thread').then((module) => ({ default: module.InkThread })));
const MorningBriefing = lazy(() => import('./components/MorningBriefing').then((module) => ({ default: module.MorningBriefing })));
const Archive = lazy(() => import('./components/Archive').then((module) => ({ default: module.Archive })));

const INK_PANEL_WIDTH = 380;

type LayoutPhase = 'opening' | 'active';

function AppLayout() {
  const [showSettings, setShowSettings] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [briefingSessionId, setBriefingSessionId] = useState(0);
  const [briefingMode, setBriefingMode] = useState<'briefing' | 'chat'>('briefing');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inkStreaming, setInkStreaming] = useState(false);
  const [layoutPhase, setLayoutPhase] = useState<LayoutPhase>('active');
  const [isEveningReflection, setIsEveningReflection] = useState(false);
  const [pendingDayReset, setPendingDayReset] = useState(false);
  const { isFocus } = useTheme();
  const {
    activeView,
    dailyPlan,
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
  } = useApp();

  const { isDragging } = useDragLayer((monitor) => ({ isDragging: monitor.isDragging() }));
  const autoBriefingCheckedRef = useRef(false);

  const checkAutoBriefing = useCallback(async (isCancelled: () => boolean) => {
    const hour = new Date().getHours();
    if (hour >= 12 || dailyPlan.committedTaskIds.length > 0) return;

    const key = `briefing.dismissed.${format(new Date(), 'yyyy-MM-dd')}`;
    const [settings, dismissed] = await Promise.all([
      window.api.settings.load(),
      window.api.store.get(key),
    ]);

    if (!isCancelled() && settings.anthropic.configured && !dismissed) {
      setBriefingMode('briefing');
      setShowBriefing(true);
      setLayoutPhase('opening');
    }
  }, [dailyPlan.committedTaskIds.length]);

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
    if (pendingDayReset) {
      void resetDay();
      setPendingDayReset(false);
    }
    setShowBriefing(false);
    setLayoutPhase('active');
    setIsEveningReflection(false);
    window.api.store.set(`briefing.dismissed.${format(new Date(), 'yyyy-MM-dd')}`, true);
  }, [pendingDayReset, resetDay]);

  // Escape key: close Ink overlay or exit focus lock
  useEffect(() => {
    if (!showBriefing && !dayLocked) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (showBriefing) closeBriefing();
      else if (dayLocked) unlockDay();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showBriefing, dayLocked, closeBriefing, unlockDay]);

  const isOpening = layoutPhase === 'opening' && showBriefing;
  const sidebarIsCollapsed = isFocus || sidebarCollapsed || dayLocked || showBriefing;
  const sourcePanelIsCollapsed = isFocus || dayLocked || isDragging;

  return (
    <div
      data-ink-open={showBriefing ? 'true' : 'false'}
      className={cn(
        'cinematic-shell relative flex h-screen w-full bg-bg text-text-primary font-sans overflow-hidden transition-colors duration-700',
        !showBriefing && 'grain'
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
                <TodaysFlow />
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
              {/* Morning: Ink left, Timeline right */}
              <div className="flex-1 min-w-0 h-full overflow-hidden" style={{ flex: '1.2 1 0%' }}>
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
              <div className="h-full overflow-hidden border-l border-border-subtle" style={{ flex: '0.8 1 0%', minWidth: 280 }}>
                <Timeline />
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
            onShowBriefing={() => { setBriefingMode('briefing'); setShowBriefing(true); }}
            onShowEveningReflection={() => { setBriefingMode('chat'); setShowBriefing(true); setIsEveningReflection(true); setLayoutPhase('opening'); }}
          />
          {/* Content area — shrinks when Ink opens via margin-right */}
          <div
            className="flex flex-1 overflow-hidden transition-[margin,padding] duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              marginRight: activeView === 'flow' && showBriefing ? INK_PANEL_WIDTH : 0
            }}
          >
            {activeView === 'flow' && (
              <>
                {/* Threads */}
                <div className={cn(
                  'shrink-0 h-full overflow-hidden transition-[width,opacity] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
                  sourcePanelIsCollapsed ? 'w-0 min-w-0 opacity-0 pointer-events-none' : 'w-[264px] opacity-100'
                )}>
                  <UnifiedInbox collapsed={sourcePanelIsCollapsed} />
                </div>
                {/* Today's Plan — slightly narrower than Day Frame */}
                <div
                  className={cn(
                    'h-full overflow-hidden transition-[width,flex,opacity,margin] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
                    isFocus ? 'w-0 min-w-0 flex-[0_0_0%] opacity-0 pointer-events-none' : 'flex-1 min-w-[280px] opacity-100'
                  )}
                  style={{ flex: isFocus ? '0 0 0%' : '0.9 1 0%' }}
                >
                  <TodaysFlow collapsed={dayLocked} />
                </div>
                {/* Day Frame — slightly wider than Plan */}
                <div className="flex-1 min-w-[320px] h-full overflow-hidden transition-[flex] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ flex: '1.1 1 0%' }}>
                  <Timeline />
                </div>
              </>
            )}
            {activeView === 'goals' && (
              <Suspense fallback={null}>
                <WeeklyIntentions />
              </Suspense>
            )}
            {activeView === 'archive' && (
              <Suspense fallback={null}>
                <Archive />
              </Suspense>
            )}
          </div>
          {/* Ink panel — slides in from right, GPU-composited transform */}
          <div
            className={cn(
              'absolute top-0 right-0 h-full z-20 transition-[transform,opacity] duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
              showBriefing
                ? 'translate-x-0 opacity-100'
                : 'translate-x-full opacity-0 pointer-events-none'
            )}
            style={{ width: INK_PANEL_WIDTH }}
          >
            {showBriefing && (
              <Suspense fallback={null}>
                <MorningBriefing
                  key={briefingSessionId}
                  mode={briefingMode}
                  onClose={closeBriefing}
                  onNewChat={() => setBriefingSessionId((value) => value + 1)}
                  onStreamingChange={setInkStreaming}
                />
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
      {!showBriefing && (
        <button
          onClick={() => {
            setActiveView('flow');
            setBriefingMode('chat');
            setBriefingSessionId((value) => value + 1);
            setShowBriefing(true);
          }}
          title="Open Ink"
          aria-label="Open Ink"
          className={cn(
            'ink-fab no-drag absolute bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg-card/92 text-text-muted shadow-[0_16px_40px_rgba(0,0,0,0.24)] backdrop-blur-md transition-[border-color,color] hover:border-accent-warm/35 hover:text-accent-warm',
            inkStreaming && 'ink-fab--thinking'
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
      )}
      <div className="absolute h-px w-px overflow-hidden -left-[9999px] top-0">
        <PomodoroTimer />
      </div>
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
                onClick={() => { setPendingDayReset(true); dismissEndOfDayPrompt(); dismissStartOfDayPrompt(); setBriefingMode('chat'); setShowBriefing(true); setIsEveningReflection(true); setLayoutPhase('opening'); }}
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
