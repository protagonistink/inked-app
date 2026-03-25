import { lazy, Suspense } from 'react';
import { useInkAssistant } from '@/context/InkAssistantContext';

const MorningBriefing = lazy(() =>
  import('@/components/ink/MorningBriefing').then((m) => ({ default: m.MorningBriefing }))
);
const TodaysFlow = lazy(() =>
  import('@/components/timeline/TodaysFlow').then((m) => ({ default: m.TodaysFlow }))
);

export interface BriefingModeProps {
  onComplete: () => void;
  isEvening: boolean;
}

export function BriefingMode({ onComplete, isEvening }: BriefingModeProps) {
  const { briefingSessionId, newChat, setInkStreaming, briefingMode } = useInkAssistant();

  return (
    <>
      {isEvening ? (
        <>
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
                onNewChat={newChat}
                onStreamingChange={setInkStreaming}
              />
            </Suspense>
          </div>
        </>
      ) : (
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <Suspense fallback={null}>
            <MorningBriefing
              key={briefingSessionId}
              mode={briefingMode}
              onClose={onComplete}
              onNewChat={newChat}
              onStreamingChange={setInkStreaming}
            />
          </Suspense>
        </div>
      )}
    </>
  );
}
