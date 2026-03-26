import { lazy, Suspense } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInkAssistant } from '@/context/InkAssistantContext';

const MorningBriefing = lazy(() =>
  import('@/components/ink/MorningBriefing').then((m) => ({ default: m.MorningBriefing }))
);

interface InkFabProps {
  /** Override the MorningBriefing mode (e.g., IntentionsView uses conditional logic) */
  briefingModeOverride?: 'briefing' | 'chat';
}

export function InkFab({ briefingModeOverride }: InkFabProps) {
  const {
    assistantOpen,
    assistantPinned,
    openAssistantPreview,
    scheduleAssistantClose,
    togglePinnedAssistant,
    inkStreaming,
    briefingSessionId,
    setInkStreaming,
  } = useInkAssistant();

  const displayMode = briefingModeOverride ?? 'chat';

  return (
    <div
      className="absolute bottom-6 right-6 z-40"
      onMouseEnter={openAssistantPreview}
      onMouseLeave={scheduleAssistantClose}
    >
      {assistantOpen && (
        <div
          className={cn(
            'assistant-overlay no-drag absolute bottom-16 right-0 w-[440px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-[28px] border border-border shadow-[0_28px_80px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-200 ease-out',
            assistantPinned ? 'opacity-100 translate-y-0' : 'opacity-100 translate-y-0'
          )}
        >
          <Suspense fallback={null}>
            <MorningBriefing
              key={briefingSessionId}
              mode={displayMode}
              variant="overlay"
              onClose={togglePinnedAssistant}
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
          'ink-fab no-drag relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-accent-warm/35 bg-accent-warm text-white shadow-[0_18px_42px_rgba(0,0,0,0.28)] backdrop-blur-md transition-[border-color,color,background-color,box-shadow] hover:border-accent-warm-hover hover:bg-accent-warm-hover hover:text-white',
          (inkStreaming || assistantPinned) && 'ink-fab--thinking',
          assistantPinned && 'border-accent-warm-hover bg-accent-warm-hover text-white shadow-[0_0_34px_rgba(200,60,47,0.35)]'
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
  );
}
