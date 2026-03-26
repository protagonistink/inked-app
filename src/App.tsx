import { lazy, Suspense, useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { cn } from './lib/utils';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, useAppShell, usePlanner } from './context/AppContext';
import { InkAssistantProvider, useInkAssistant } from './context/InkAssistantContext';
import { DragOverlay } from './components/shared/DragOverlay';
import { ErrorBoundary, RootFallback, ModeFallback } from './components/shared/ErrorBoundary';
import { AtmosphereLayer } from './components/AtmosphereLayer';
import { Sidebar } from './components/chrome/Sidebar';
import { Settings } from './components/chrome/Settings';
import { useBriefingLifecycle } from './hooks/useBriefingLifecycle';
import { useCaptures } from './hooks/useCaptures';
import { Skeleton } from './components/shared/Skeleton';

const CaptureOverlay = lazy(() => import('./components/capture/CaptureOverlay').then((m) => ({ default: m.CaptureOverlay })));
const CapturePopover = lazy(() => import('./components/capture/CapturePopover').then((m) => ({ default: m.CapturePopover })));

const BriefingMode = lazy(() => import('./modes/BriefingMode').then((m) => ({ default: m.BriefingMode })));
const PlanningMode = lazy(() => import('./modes/PlanningMode').then((m) => ({ default: m.PlanningMode })));
const ExecutingMode = lazy(() => import('./modes/ExecutingMode').then((m) => ({ default: m.ExecutingMode })));
const FocusMode = lazy(() => import('./modes/FocusMode').then((m) => ({ default: m.FocusMode })));
const CommandPalette = lazy(() => import('./components/chrome/CommandPalette').then((m) => ({ default: m.CommandPalette })));
const InkThread = lazy(() => import('./components/ink/Thread').then((m) => ({ default: m.InkThread })));
const IntentionsView = lazy(() => import('./components/intentions/IntentionsView').then((m) => ({ default: m.IntentionsView })));

function AppLayout() {
  const {
    mode,
    view,
    focusTaskId,
    startDay,
    exitFocus,
    setView,
    resetAppMode,
  } = useAppShell();
  const { setViewDate } = usePlanner();

  const { assistantOpen, assistantPinned, closeAssistant, openInkChat } = useInkAssistant();
  const { isEveningReflection, openFullscreenInk, requestDayReset, closeBriefing } = useBriefingLifecycle();

  const [showSettings, setShowSettings] = useState(false);
  const { captures, addCapture, removeCapture, refresh: refreshCaptures } = useCaptures();
  const [captureOverlayOpen, setCaptureOverlayOpen] = useState(false);
  const [capturePopoverOpen, setCapturePopoverOpen] = useState(false);

  // Listen for global shortcut
  useEffect(() => {
    return window.api.capture.onOpenOverlay(() => setCaptureOverlayOpen(true));
  }, []);

  // Midnight purge
  useEffect(() => {
    const checkMidnight = setInterval(() => {
      window.api.capture.purgeStale().then(() => refreshCaptures());
    }, 60_000);
    return () => clearInterval(checkMidnight);
  }, [refreshCaptures]);

  const openPlot = () => {
    openFullscreenInk();
  };

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
      if (e.defaultPrevented || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }

      const isViewShortcut = e.metaKey || e.ctrlKey || (!e.metaKey && !e.ctrlKey);

      if (!isViewShortcut) return;

      if (e.key === '1') {
        e.preventDefault();
        setViewDate(new Date());
        setView('flow');
      } else if (e.key === '2') {
        e.preventDefault();
        setView('intentions');
      } else if (e.key === '3') {
        e.preventDefault();
        openPlot();
      } else if (e.key === '0') {
        e.preventDefault();
        setCapturePopoverOpen((v) => !v);
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
      window.api.menu.onOpenInk(() => openInkChat()),
      window.api.menu.onOpenPlot(() => openPlot()),
      window.api.menu.onStartDay(() => startDay()),
      window.api.menu.onGoToday(() => setViewDate(new Date())),
    ];
    return () => cleanups.forEach((fn) => fn());
  }, [setView, openInkChat, openPlot, startDay, setViewDate]);

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
        <Sidebar
          onSettingsClick={() => setShowSettings(true)}
          onPlotClick={openPlot}
          onCaptureClick={() => setCapturePopoverOpen(v => !v)}
          captureCount={captures.length}
        />
      )}

      <main aria-live="polite" className={cn('flex flex-1 overflow-hidden', mode !== 'focus' && 'ml-12')}>
        <div
          key={`${mode}-${view}`}
          className="animate-fade-in flex-1 flex overflow-hidden"
        >
            {view === 'intentions' ? (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <Suspense fallback={<Skeleton />}>
                  <IntentionsView />
                </Suspense>
              </ErrorBoundary>
            ) : mode === 'briefing' ? (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <Suspense fallback={<Skeleton />}>
                  <BriefingMode
                    onComplete={closeBriefing}
                    isEvening={isEveningReflection}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : mode === 'focus' && focusTaskId ? (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <Suspense fallback={<Skeleton />}>
                  <FocusMode taskId={focusTaskId} onExit={exitFocus} />
                </Suspense>
              </ErrorBoundary>
            ) : mode === 'planning' ? (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <Suspense fallback={<Skeleton />}>
                  <PlanningMode
                    onOpenInk={openFullscreenInk}
                    onEndDay={requestDayReset}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <ErrorBoundary resetKeys={[mode, view]} onReset={resetAppMode} fallback={modeFallback}>
                <Suspense fallback={<Skeleton />}>
                  <ExecutingMode
                    onOpenInk={openFullscreenInk}
                    onEndDay={requestDayReset}
                  />
                </Suspense>
              </ErrorBoundary>
            )}
        </div>
      </main>

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      <DragOverlay />
      <Suspense fallback={null}>
        <InkThread />
      </Suspense>
      <Suspense fallback={null}>
        <CommandPalette onOpenSettings={() => setShowSettings(true)} onOpenInk={openInkChat} onOpenPlot={openPlot} />
      </Suspense>

      <Suspense fallback={null}>
        <CaptureOverlay
          open={captureOverlayOpen}
          onClose={() => setCaptureOverlayOpen(false)}
          onSubmit={async (text) => { await addCapture(text); }}
        />
      </Suspense>

      {capturePopoverOpen && (
        <>
          <div
            className="fixed inset-0 z-[55]"
            onClick={() => setCapturePopoverOpen(false)}
            aria-hidden="true"
          />
          <Suspense fallback={null}>
            <CapturePopover
              captures={captures}
              onAdd={addCapture}
              onMakeTask={async (entry) => {
                await window.api.asana.createTask(entry.text);
                await removeCapture(entry.id);
              }}
              onSendToNotion={async (entry) => {
                await window.api.capture.sendToNotion(entry.text);
                await removeCapture(entry.id);
              }}
              onDismiss={removeCapture}
              onClose={() => setCapturePopoverOpen(false)}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}

function AppLayoutWithInk() {
  const { mode, view } = useAppShell();
  return (
    <InkAssistantProvider mode={mode} view={view}>
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
