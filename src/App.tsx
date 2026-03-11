import { useEffect, useState } from 'react';
import { format, startOfWeek } from 'date-fns';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { UnifiedInbox } from './components/UnifiedInbox';
import { TodaysFlow } from './components/TodaysFlow';
import { Timeline } from './components/Timeline';
import { Settings } from './components/Settings';
import { CommandPalette } from './components/CommandPalette';
import { WeeklyIntentions } from './components/WeeklyIntentions';
import { PomodoroTimer } from './components/PomodoroTimer';
import { WeeklyPlanningWizard } from './components/WeeklyPlanningWizard';
import { DragOverlay } from './components/DragOverlay';
import { InkThread } from './components/Thread';
import { AtmosphereLayer } from './components/AtmosphereLayer';
import { MorningBriefing } from './components/MorningBriefing';
import { useTheme } from './context/ThemeContext';

function ArchiveView() {
  const { archiveTasks } = useApp();

  return (
    <div className="flex-1 bg-bg px-8 py-8 overflow-y-auto">
      <div className="rounded-lg border border-border bg-bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-medium text-text-emphasis">Archive</h2>
          <span className="text-[11px] font-mono text-text-muted">{archiveTasks.length} kept</span>
        </div>
        <div className="flex flex-col gap-3">
          {archiveTasks.length === 0 ? (
            <div className="text-[13px] text-text-muted">Nothing has moved out of the day yet.</div>
          ) : (
            archiveTasks.map((task) => (
              <div key={task.id} className="rounded-md border border-border-subtle bg-bg px-4 py-3">
                <div className="text-[13px] text-text-primary">{task.title}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mt-1">{task.status}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AppLayout() {
  const [showSettings, setShowSettings] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sourceCollapsed, setSourceCollapsed] = useState(false);
  const { isFocus } = useTheme();
  const {
    activeView,
    activeSource,
    lastCommitTimestamp,
    weeklyPlanningLastCompleted,
    openWeeklyPlanning,
    dailyPlan,
  } = useApp();

  // Auto-open briefing: before noon, no commits yet, API key configured
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12 && dailyPlan.committedTaskIds.length === 0) {
      window.api.store.get('anthropic.apiKey').then((key) => {
        if (key) {
          window.api.store.get(`briefing.dismissed.${format(new Date(), 'yyyy-MM-dd')}`).then((dismissed) => {
            if (!dismissed) setShowBriefing(true);
          });
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const now = new Date();
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const isMondayMorning = now.getDay() === 1 && now.getHours() < 12;

    if (isMondayMorning && (!weeklyPlanningLastCompleted || weeklyPlanningLastCompleted < weekStart)) {
      openWeeklyPlanning();
    }
  }, [openWeeklyPlanning, weeklyPlanningLastCompleted]);

  useEffect(() => {
    if (activeView !== 'flow' || !lastCommitTimestamp || isFocus) return;
    setSourceCollapsed(true);
  }, [activeView, isFocus, lastCommitTimestamp]);

  useEffect(() => {
    if (activeSource !== 'cover') {
      setSourceCollapsed(false);
      setSidebarCollapsed(false);
      return;
    }

    if (activeView !== 'flow') {
      setSourceCollapsed(false);
    }
  }, [activeSource, activeView]);

  const sidebarIsCollapsed = isFocus || sidebarCollapsed;
  const sourcePanelIsCollapsed = isFocus || (activeView === 'flow' && sourceCollapsed);

  return (
    <div className="grain cinematic-shell relative flex h-screen w-full bg-bg text-text-primary font-sans overflow-hidden transition-colors duration-700">
      <AtmosphereLayer />
      <Sidebar
        collapsed={sidebarIsCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        onSettingsClick={() => setShowSettings(true)}
        onShowBriefing={() => setShowBriefing(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        {activeView === 'flow' && (
          <>
            <UnifiedInbox collapsed={sourcePanelIsCollapsed} />
            <TodaysFlow />
            {showBriefing ? (
              <MorningBriefing onClose={() => {
                setShowBriefing(false);
                window.api.store.set(`briefing.dismissed.${format(new Date(), 'yyyy-MM-dd')}`, true);
              }} />
            ) : (
              <Timeline />
            )}
          </>
        )}
        {activeView === 'goals' && (
          <>
            <UnifiedInbox collapsed={isFocus} />
            <WeeklyIntentions />
          </>
        )}
        {activeView === 'archive' && <ArchiveView />}
      </div>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      <WeeklyPlanningWizard />
      <DragOverlay />
      <InkThread />
      <div className="hidden">
        <PomodoroTimer />
      </div>
      <CommandPalette />
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
