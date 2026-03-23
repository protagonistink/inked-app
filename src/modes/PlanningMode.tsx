import { lazy, Suspense, useState } from 'react';
import { ChevronsLeft, ChevronsRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/Sidebar';
import { UnifiedInbox } from '@/components/UnifiedInbox';
import { Timeline } from '@/components/Timeline';
import { RightRail } from '@/components/rail/RightRail';

const MorningBriefing = lazy(() =>
  import('@/components/MorningBriefing').then((m) => ({ default: m.MorningBriefing }))
);

export interface PlanningModeProps {
  onStartDay: () => void;
  onOpenInk: () => void;
  onSettings: () => void;
  onEndDay: () => void;
  // Ink assistant state
  assistantOpen: boolean;
  assistantPinned: boolean;
  onAssistantHover: () => void;
  onAssistantLeave: () => void;
  onToggleAssistant: () => void;
  inkStreaming: boolean;
  briefingSessionId: number;
  onNewChat: () => void;
  onStreamingChange: (streaming: boolean) => void;
}

export function PlanningMode({
  onStartDay: _onStartDay,
  onOpenInk,
  onSettings,
  onEndDay,
  assistantOpen,
  assistantPinned,
  onAssistantHover,
  onAssistantLeave,
  onToggleAssistant,
  inkStreaming,
  briefingSessionId,
  onNewChat,
  onStreamingChange,
}: PlanningModeProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inboxCollapsed, setInboxCollapsed] = useState(false);

  return (
    <>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        onSettingsClick={onSettings}
        onShowBriefing={onOpenInk}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Inbox column */}
        <div className="relative shrink-0 h-full flex">
          {inboxCollapsed && (
            <button
              onClick={() => setInboxCollapsed(false)}
              title="Open source list"
              aria-label="Open source list"
              className="flex h-full w-10 shrink-0 items-center justify-center border-r border-border-subtle bg-bg text-text-muted transition-colors hover:text-text-primary"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          )}
          <div
            className={cn(
              'relative h-full overflow-hidden transition-[width,opacity] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
              inboxCollapsed ? 'w-0 min-w-0 opacity-0 pointer-events-none' : 'w-[280px] opacity-100'
            )}
          >
            {!inboxCollapsed && (
              <button
                onClick={() => setInboxCollapsed(true)}
                title="Collapse source list"
                aria-label="Collapse source list"
                className="absolute right-3 top-3 z-10 rounded-md border border-border-subtle bg-bg-card/90 p-1 text-text-muted backdrop-blur-sm transition-colors hover:text-text-primary"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
            )}
            <UnifiedInbox collapsed={inboxCollapsed} />
          </div>
        </div>

        {/* Timeline — center column */}
        <div className="flex-1 min-w-[320px] h-full overflow-hidden">
          <Timeline />
        </div>

        {/* Right Rail */}
        <RightRail onOpenInk={onOpenInk} onEndDay={onEndDay} />
      </div>

      {/* Ink floating button (bottom-right) */}
      <div
        className="absolute bottom-6 right-6 z-40"
        onMouseEnter={onAssistantHover}
        onMouseLeave={onAssistantLeave}
      >
        {assistantOpen && (
          <div
            className={cn(
              'assistant-overlay no-drag absolute bottom-16 right-0 w-[440px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-[28px] border border-[#243041] shadow-[0_28px_80px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-200 ease-out',
              assistantPinned ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0'
            )}
          >
            <Suspense fallback={null}>
              <MorningBriefing
                key={briefingSessionId}
                mode="chat"
                variant="overlay"
                onClose={onToggleAssistant}
                onNewChat={onNewChat}
                onStreamingChange={onStreamingChange}
              />
            </Suspense>
          </div>
        )}
        <button
          onClick={onToggleAssistant}
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
    </>
  );
}
