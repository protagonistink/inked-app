import { lazy, Suspense } from 'react';
import { Sidebar } from '@/components/Sidebar';

const MorningBriefing = lazy(() =>
  import('@/components/MorningBriefing').then((m) => ({ default: m.MorningBriefing }))
);
const TodaysFlow = lazy(() =>
  import('@/components/TodaysFlow').then((m) => ({ default: m.TodaysFlow }))
);

export interface BriefingModeProps {
  onComplete: () => void;
  onSettings: () => void;
  isEvening: boolean;
  briefingSessionId: number;
  onNewChat: () => void;
  onStreamingChange: (streaming: boolean) => void;
  briefingMode: 'briefing' | 'chat';
}

export function BriefingMode({
  onComplete,
  onSettings,
  isEvening,
  briefingSessionId,
  onNewChat,
  onStreamingChange,
  briefingMode,
}: BriefingModeProps) {
  return (
    <>
      {/* Collapsed sidebar — icon strip only */}
      <Sidebar
        collapsed
        onToggleCollapse={onComplete}
        onSettingsClick={onSettings}
        onShowBriefing={() => {}}
      />

      {isEvening ? (
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
                onClose={onComplete}
                onNewChat={onNewChat}
                onStreamingChange={onStreamingChange}
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
                onClose={onComplete}
                onNewChat={onNewChat}
                onStreamingChange={onStreamingChange}
              />
            </Suspense>
          </div>
        </>
      )}
    </>
  );
}
