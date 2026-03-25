import { lazy, Suspense, useEffect, useState } from 'react';
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
import { useBriefingLifecycle } from './hooks/useBriefingLifecycle';
import { BriefingMode } from './modes/BriefingMode';
import { PlanningMode } from './modes/PlanningMode';
import { ExecutingMode } from './modes/ExecutingMode';
import { FocusMode } from './modes/FocusMode';
import { Skeleton } from './components/shared/Skeleton';

const Settings = lazy(() => import('./components/chrome/Settings').then((m) => ({ default: m.Settings })));
const CommandPalette = lazy(() => import('./components/chrome/CommandPalette').then((m) => ({ default: m.CommandPalette })));
const InkThread = lazy(() => import('./components/ink/Thread').then((m) => ({ default: m.InkThread })));
const IntentionsView = lazy(() => import('./components/intentions/IntentionsView').then((m) => ({ default: m.IntentionsView })));

function AppLayout() {
  const {
    mode,
    view,
    focusTaskId,
    startDay,
    enterFocus,
    exitFocus,
    openInbox,
    setView,
    setViewDate,
    resetAppMode,
  } = useApp();

  const { assistantOpen, assistantPinned, closeAssistant } = useInkAssistant();
  const { isEveningReflection, openFullscreenInk, requestDayReset, closeBriefing } = useBriefingLifecycle();

  const [showSettings, setShowSettings] = useState(false);

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
                <Suspense fallback={<Skeleton />}>
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
                  onEndDay={requestDayReset}
                />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <ExecutingMode
                  onEnterFocus={enterFocus}
                  onOpenInk={openFullscreenInk}
                  onOpenInbox={openInbox}
                  onEndDay={requestDayReset}
                />
              </ErrorBoundary>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {showSettings && (
        <Suspense fallback={<Skeleton variant="inline" />}>
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
