import { useState, useEffect, useRef, useCallback } from 'react';
import { format, parseISO, getISOWeek } from 'date-fns';
import { useApp } from '@/context/AppContext';

function QuillIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M16 2C16 2 13.5 6.5 10 9C6.5 11.5 3 12 3 12L8.5 17C8.5 17 9 13.5 11.5 11C14 8.5 18 6.5 18 6.5L16 2Z"
        fill="rgba(210,100,55,0.5)"
      />
      <path
        d="M8.5 17L3 18.5L4.5 13.5"
        stroke="rgba(210,100,55,0.4)"
        strokeWidth="0.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="8.5" y1="17" x2="4.5" y2="13"
        stroke="rgba(210,100,55,0.35)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function Archive() {
  const { dayEntries, saveDayEntry, archiveTasks } = useApp();
  const today = getToday();

  // Build a merged list: today always at top, then older entries sorted desc
  const entryDates = Array.from(
    new Set([today, ...dayEntries.map((e) => e.date)])
  ).sort((a, b) => b.localeCompare(a));

  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Textarea draft text — held locally, debounced before persisting
  const currentEntry = dayEntries.find((e) => e.date === selectedDate);
  const [draftText, setDraftText] = useState(currentEntry?.journalText ?? '');
  const [savedIndicator, setSavedIndicator] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when switching dates
  useEffect(() => {
    const entry = dayEntries.find((e) => e.date === selectedDate);
    setDraftText(entry?.journalText ?? '');
    setSavedIndicator(false);
  }, [selectedDate, dayEntries]);

  // Focus textarea when switching dates
  useEffect(() => {
    const timeout = setTimeout(() => textareaRef.current?.focus(), 80);
    return () => clearTimeout(timeout);
  }, [selectedDate]);

  const handleChange = useCallback((text: string) => {
    setDraftText(text);
    setSavedIndicator(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveDayEntry(selectedDate, text);
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2000);
    }, 1500);
  }, [selectedDate, saveDayEntry]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Chapter number: from stored entry or next available
  const chapterForDate = (date: string): number => {
    const entry = dayEntries.find((e) => e.date === date);
    if (entry) return entry.chapterNumber;
    return dayEntries.length + 1;
  };

  const wordCount = draftText.trim() ? draftText.trim().split(/\s+/).length : 0;

  const archiveTasksForDate = selectedDate === today ? archiveTasks : [];

  return (
    <div className="flex h-full w-full bg-bg overflow-hidden">
      {/* Chapter list — left column */}
      <div className="w-[220px] shrink-0 flex flex-col border-r border-[rgba(255,255,255,0.05)] overflow-y-auto py-8">
        <div className="px-5 mb-5">
          <span className="text-[9px] uppercase tracking-[0.22em] text-text-muted/50">Journal</span>
        </div>
        <div className="flex flex-col gap-0.5 px-2">
          {entryDates.map((date) => {
            const entry = dayEntries.find((e) => e.date === date);
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const chapter = chapterForDate(date);
            const hasText = entry && entry.journalText.trim().length > 0;

            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`w-full text-left rounded-[3px] px-3 py-2.5 transition-colors duration-150 ${
                  isSelected
                    ? 'bg-[rgba(255,255,255,0.05)]'
                    : 'hover:bg-[rgba(255,255,255,0.03)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[12px] leading-tight ${
                      isSelected ? 'text-text-primary' : 'text-text-muted'
                    }`}
                  >
                    {isToday
                      ? 'Today'
                      : format(parseISO(date), 'MMM d')}
                  </span>
                  {isToday && (
                    <span className="text-[8px] uppercase tracking-[0.16em] text-accent-warm/60">
                      now
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-text-muted/40">
                    Ch. {chapter}
                  </span>
                  {hasText && (
                    <span className="text-[8px] text-text-muted/30">
                      {entry!.journalText.trim().split(/\s+/).length}w
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Writing surface — right column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[580px] mx-auto px-8 pt-12 pb-20">
            {/* Entry header */}
            <div className="flex items-start justify-between mb-1">
              <div>
                <h1 className="font-display italic text-[28px] text-text-emphasis leading-tight">
                  {selectedDate === today
                    ? format(new Date(), 'MMMM d, yyyy')
                    : format(parseISO(selectedDate), 'MMMM d, yyyy')}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-text-muted/50">
                    Chapter {chapterForDate(selectedDate)}
                  </span>
                  <span className="text-[9px] text-text-muted/30">·</span>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-text-muted/40">
                    Week {getISOWeek(selectedDate === today ? new Date() : parseISO(selectedDate))}
                  </span>
                </div>
              </div>
              <QuillIcon className="mt-1 opacity-80 shrink-0" />
            </div>

            {/* Hairline separator */}
            <div className="h-px bg-[rgba(255,255,255,0.05)] mt-5 mb-8" />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={draftText}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="What did today mean?"
              className="archive-textarea w-full bg-transparent border-none outline-none resize-none font-display italic text-[17px] leading-[1.85] text-[rgba(225,215,200,0.88)] placeholder:text-[rgba(225,215,200,0.2)] min-h-[320px]"
              style={{ caretColor: 'rgba(210,100,55,0.7)' }}
            />

            {/* Archived tasks for this day */}
            {archiveTasksForDate.length > 0 && (
              <div className="mt-10">
                <div className="h-px bg-[rgba(255,255,255,0.04)] mb-6" />
                <div className="text-[9px] uppercase tracking-[0.2em] text-text-muted/40 mb-3">
                  Completed
                </div>
                <div className="flex flex-col gap-2">
                  {archiveTasksForDate.map((task) => (
                    <div key={task.id} className="flex items-start gap-3">
                      <span className="mt-[5px] w-1 h-1 rounded-full bg-[rgba(190,90,55,0.3)] shrink-0" />
                      <span className="text-[12px] text-text-muted/60 leading-relaxed">{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[rgba(255,255,255,0.04)] px-8 py-3 flex items-center justify-between">
          <div className="max-w-[580px] mx-auto w-full flex items-center justify-between">
            <span className="text-[10px] text-text-muted/30">
              {wordCount > 0 ? `${wordCount} word${wordCount !== 1 ? 's' : ''}` : ''}
            </span>
            <span
              className={`text-[10px] tracking-[0.12em] transition-opacity duration-300 ${
                savedIndicator ? 'opacity-60 text-text-muted' : 'opacity-0 text-text-muted'
              }`}
            >
              Saved
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
