// src/components/MorningBriefing.tsx
import { useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import type { BriefingVariant } from '@/types/briefing';
import { useBriefingState } from '@/hooks/useBriefingState';
import { MorningWelcome } from './MorningWelcome';
import { MorningSidebar } from './MorningSidebar';
import { MessageBubble } from './MessageBubble';
import { ScheduleChips } from '../ScheduleChips';
import { CommitChips } from '../CommitChips';
import { RitualSuggestions } from '../RitualSuggestions';
import { BriefingInput } from './BriefingInput';
import { MarkdownRenderer } from './MarkdownRenderer';
import { GravityPrompt } from '@/components/shared/GravityPrompt';

export function MorningBriefing({
  onClose,
  onStreamingChange,
  mode = 'briefing',
  variant = 'fullscreen',
}: {
  onClose: () => void;
  onStreamingChange?: (streaming: boolean) => void;
  mode?: 'briefing' | 'chat';
  variant?: BriefingVariant;
}) {
  const { state, actions } = useBriefingState({ onClose, onStreamingChange, mode, variant });
  const { isLight } = useTheme();
  const [showThreads, setShowThreads] = useState(false);
  const handleNewChat = async () => {
    setShowThreads(false);
    await actions.startNewThread();
  };

  const isEvening = state.promptInkMode === 'evening';

  return (
    <div
      className={cn('relative flex h-full w-full', state.isOverlay && 'rounded-[28px]')}
      style={{
        backgroundColor: 'var(--color-bg)',
        backgroundImage: isLight
          ? 'radial-gradient(ellipse at 20% 20%, rgba(200,60,47,0.06), transparent 55%), radial-gradient(ellipse at 80% 100%, rgba(30,63,102,0.05), transparent 50%)'
          : 'radial-gradient(ellipse at 20% 20%, var(--color-bg-elevated), var(--color-bg) 70%)',
        color: 'var(--color-text-primary)',
      }}
    >
      {/* Warm/cool top gradient overlay */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-64 z-0',
          isEvening
            ? 'bg-gradient-to-b from-[rgba(45,212,191,0.03)] via-transparent to-transparent'
            : 'bg-gradient-to-b from-[rgba(200,60,47,0.04)] via-transparent to-transparent'
        )}
      />

      {!state.isOverlay && <div className="drag-region" />}

      {/* Left Column */}
      <div
        className="flex-1 flex flex-col min-w-0 h-full"
        style={{ padding: state.isOverlay ? '1.5rem' : '4rem' }}
      >
        {state.isWelcomeScreen ? (
          <MorningWelcome
            onStartDay={actions.handleStartDay}
            compact={state.isOverlay}
            inkMode={state.promptInkMode}
            mode={mode}
          />
        ) : (
          <>
            {/* Header */}
            <div className={cn('flex items-center justify-between shrink-0', state.isOverlay ? 'mb-4' : 'mb-6')}>
              <div className="flex items-center gap-2">
                <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                  {format(state.viewDate, 'EEEE, MMM d')}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowThreads((prev) => !prev)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md text-[10px] uppercase tracking-[0.14em] transition-colors hover:text-white',
                      state.isOverlay ? 'px-2 py-1.5' : 'px-2.5 py-1.5'
                    )}
                    style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', background: 'transparent' }}
                    title="Open thread list"
                  >
                    Threads
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showThreads && (
                    <div
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[320px] overflow-hidden rounded-xl border shadow-2xl"
                      style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}
                    >
                      <div className="border-b px-3 py-2 text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>
                        Recent threads
                      </div>
                      <div className="max-h-[320px] overflow-y-auto p-2">
                        {state.threads.length === 0 ? (
                          <div className="px-2 py-4 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                            No saved threads yet.
                          </div>
                        ) : (
                          state.threads.map((thread) => (
                            <button
                              key={thread.id}
                              onClick={() => {
                                setShowThreads(false);
                                void actions.selectThread(thread.id);
                              }}
                              className={cn(
                                'mb-1 flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors',
                                state.activeThreadId === thread.id ? 'bg-accent-warm/10' : 'hover:bg-bg-elevated'
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                  {thread.title}
                                </span>
                                <span className="shrink-0 text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-muted)' }}>
                                  {format(new Date(thread.updatedAt), 'MMM d')}
                                </span>
                              </div>
                              <span className="mt-1 line-clamp-2 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
                                {thread.preview || 'Empty thread'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { void handleNewChat(); }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md text-[10px] uppercase tracking-[0.14em] transition-colors hover:text-white',
                    state.isOverlay ? 'px-2 py-1.5' : 'px-2.5 py-1.5'
                  )}
                  style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', background: 'transparent' }}
                  title="Start a new chat"
                >
                  <RotateCcw className="w-3 h-3" />
                  New chat
                </button>
                <button
                  onClick={onClose}
                  className={cn(
                    'rounded-md text-[10px] uppercase tracking-[0.14em] transition-colors hover:text-white',
                    state.isOverlay ? 'px-2 py-1.5' : 'px-2.5 py-1.5'
                  )}
                  style={{ color: 'var(--color-text-muted)', background: 'transparent' }}
                  title="Close"
                >
                  Done
                </button>
              </div>
            </div>
            {state.activeThreadTitle && (
              <div className="mb-4 text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
                Thread: {state.activeThreadTitle}
              </div>
            )}

            <GravityPrompt />

            {/* Messages area */}
            <div className={cn('flex-1 overflow-y-auto flex flex-col hide-scrollbar', state.isOverlay ? 'gap-4' : 'gap-6')}>
              {state.phase === 'interview' && state.messages.length <= 1 && !state.streamingContent && (
                <div className="pb-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--color-text-secondary)' }}>
                    Weekly interview
                  </div>
                  <div className={cn('mt-3 font-display font-bold leading-snug tracking-[-0.02em]', state.isOverlay ? 'text-[20px]' : 'text-[24px]')} style={{ color: 'var(--color-text-emphasis)' }}>
                    Let&apos;s see the week.
                  </div>
                </div>
              )}

              {state.messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} isFirst={i === 0} />
              ))}

              {/* Streaming */}
              {state.streamingContent && (
                <div className="flex gap-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className={cn('prose-briefing', state.isOverlay ? 'text-[14px] leading-[1.65]' : 'text-[15px] leading-relaxed')} style={{ color: 'var(--color-text-primary)' }}>
                      {state.visibleStreamingContent ? (
                        <MarkdownRenderer content={state.visibleStreamingContent} />
                      ) : null}
                      <span className="inline-block w-[2px] h-[14px] bg-accent-warm animate-pulse ml-0.5 align-text-bottom" />
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {state.error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-[12px] text-red-300 leading-relaxed">{state.error}</div>
                </div>
              )}

              {/* Schedule chips */}
              {state.phase === 'committing' && state.scheduleChips.length > 0 && !state.committed && (
                <ScheduleChips
                  chips={state.scheduleChips}
                  proposalLabel={state.proposalLabel}
                  isOverlay={state.isOverlay}
                  weeklyGoals={state.weeklyGoals}
                  onToggle={actions.toggleScheduleChip}
                  onExecute={() => void actions.executeSchedule()}
                  onReorder={actions.reorderScheduleChip}
                />
              )}

              {/* Commit chips */}
              {state.phase === 'committing' && state.commitChips.length > 0 && state.scheduleChips.length === 0 && !state.committed && (
                <CommitChips
                  chips={state.commitChips}
                  proposalLabel={state.proposalLabel}
                  isOverlay={state.isOverlay}
                  weeklyGoals={state.weeklyGoals}
                  onToggle={actions.toggleChip}
                  onExecute={actions.executeCommit}
                />
              )}

              {/* Ritual suggestions */}
              {state.pendingRituals.length > 0 && (
                <RitualSuggestions
                  rituals={state.pendingRituals}
                  onAdd={state.addRitual}
                  onSkip={state.skipRitual}
                />
              )}

              {/* Committed confirmation */}
              {state.committed && (
                <div className="flex items-center justify-center py-6">
                  <div className="text-center animate-fade-in">
                    <div className="font-display font-bold text-[22px] tracking-[-0.02em]" style={{ color: 'var(--color-text-emphasis)' }}>Held.</div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Plan locked in</div>
                  </div>
                </div>
              )}

              <div ref={state.messagesEndRef} />
            </div>

            {/* Input area */}
            {!state.committed && (
              <BriefingInput
                inputValue={state.inputValue}
                attachments={state.attachments}
                isStreaming={state.isStreaming}
                isDraggingFiles={state.isDraggingFiles}
                phase={state.phase}
                messagesLength={state.messages.length}
                isOverlay={state.isOverlay}
                inputRef={state.inputRef}
                fileInputRef={state.fileInputRef}
                onChange={state.setInputValue}
                onKeyDown={actions.handleKeyDown}
                onSend={actions.sendMessage}
                onShowCommit={actions.showCommitChips}
                onPickImages={(files) => void actions.addImageAttachments(files)}
                onRemoveAttachment={actions.removeAttachment}
                onDragStateChange={actions.setDraggingFiles}
              />
            )}
          </>
        )}
      </div>

      {!state.isOverlay && <MorningSidebar />}
    </div>
  );
}
