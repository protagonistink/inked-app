import { useState } from 'react';
import { ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifiedInbox } from '@/components/inbox/UnifiedInbox';
import { Timeline } from '@/components/timeline/Timeline';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { RightRail } from '@/components/rail/RightRail';
import { InkFab } from '@/components/ink/InkFab';

export interface ExecutingModeProps {
  onEnterFocus: (taskId: string) => void;
  onOpenInk: () => void;
  onOpenInbox: () => void;
  onEndDay: () => void;
}

export function ExecutingMode({
  onOpenInk,
  onOpenInbox,
  onEndDay,
}: ExecutingModeProps) {
  const [inboxVisible, setInboxVisible] = useState(false);

  function handleOpenInbox() {
    setInboxVisible(true);
    onOpenInbox();
  }

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        {/* Inbox — hidden by default, temporarily expandable */}
        <div className="relative shrink-0 h-full flex">
          {!inboxVisible && (
            <button
              onClick={handleOpenInbox}
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
              !inboxVisible ? 'w-0 min-w-0 opacity-0 pointer-events-none' : 'w-[280px] opacity-100'
            )}
          >
            <UnifiedInbox collapsed={!inboxVisible} />
          </div>
        </div>

        {/* Timeline — center column, wider without inbox */}
        <div className="flex-1 min-w-[320px] h-full overflow-hidden">
          <Timeline />
        </div>

        {/* Right Rail */}
        <RightRail onOpenInk={onOpenInk} onEndDay={onEndDay} />
      </div>

      <InkFab />

      {/* Hidden PomodoroTimer — mounted off-screen for tray functionality */}
      <div className="absolute h-px w-px overflow-hidden -left-[9999px] top-0">
        <PomodoroTimer />
      </div>
    </>
  );
}
