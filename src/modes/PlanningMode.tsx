import { useState } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UnifiedInbox } from '@/components/inbox/UnifiedInbox';
import { Timeline } from '@/components/timeline/Timeline';
import { RightRail } from '@/components/rail/RightRail';
import { InkFab } from '@/components/ink/InkFab';

export interface PlanningModeProps {
  onStartDay: () => void;
  onOpenInk: () => void;
  onEndDay: () => void;
}

export function PlanningMode({
  onStartDay: _onStartDay,
  onOpenInk,
  onEndDay,
}: PlanningModeProps) {
  const [inboxCollapsed, setInboxCollapsed] = useState(false);

  return (
    <>
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
                className="absolute right-3 top-10 z-10 rounded-md border border-border-subtle bg-bg-card/90 p-1 text-text-muted backdrop-blur-sm transition-colors hover:text-text-primary"
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

      <InkFab />
    </>
  );
}
