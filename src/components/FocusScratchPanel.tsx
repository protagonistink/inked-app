import { useState, useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { X, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScratchEntry } from '@/types/electron';

/* ── Compact capture bar for focus mode ── */

function FocusCaptureBar({ onSave }: { onSave: (text: string) => void }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSave(value.trim());
    setValue('');
    textareaRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setValue('');
      textareaRef.current?.blur();
    }
  };

  return (
    <div className="px-5 pb-4">
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.10] transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Capture a thought..."
          rows={1}
          className="w-full bg-transparent border-none outline-none resize-none px-3 py-2.5 text-[13px] leading-relaxed text-text-primary/85 placeholder:text-text-muted/25"
          style={{ caretColor: 'rgba(190,90,55,0.9)' }}
        />
      </div>
    </div>
  );
}

/* ── Paper-textured scratch card ── */

function FocusCard({
  entry,
  onDelete,
}: {
  entry: ScratchEntry;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        'group relative rounded-lg px-3.5 py-3 pr-8 transition-all duration-150',
        'bg-[#1c1b19]/60 border border-amber-900/[0.08]',
        'hover:bg-[#1c1b19]/80 hover:border-amber-900/[0.14]',
        // Subtle paper grain via layered gradients
        'bg-gradient-to-br from-[#1d1c19]/60 via-[#1a1917]/60 to-[#1c1b18]/60'
      )}
      style={{
        backgroundImage: `
          linear-gradient(135deg, rgba(255,248,230,0.012) 0%, transparent 50%, rgba(255,248,230,0.008) 100%),
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E")
        `,
      }}
    >
      <div className="text-[13px] leading-[1.65] text-text-primary/80 whitespace-pre-wrap break-words">
        {entry.text}
      </div>
      <div className="mt-1.5 text-[10px] tracking-[0.08em] text-text-muted/25">
        {format(parseISO(entry.createdAt), 'h:mm a')}
      </div>
      <button
        onClick={() => void onDelete(entry.id)}
        className="absolute top-2.5 right-2 p-0.5 text-text-muted/0 group-hover:text-text-muted/30 hover:!text-text-muted/70 transition-colors"
      >
        <X size={11} />
      </button>
    </div>
  );
}

/* ── Main focus scratch panel ── */

export function FocusScratchPanel() {
  const [entries, setEntries] = useState<ScratchEntry[]>([]);

  useEffect(() => {
    void window.api.capture.getToday().then(setEntries);

    const unsubNew = window.api.capture.onNewEntry((entry) => {
      setEntries((prev) => [...prev, entry]);
    });

    const unsubUpdated = window.api.capture.onEntryUpdated((entry) => {
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
    });

    const unsubDeleted = window.api.capture.onEntryDeleted((id) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    });

    return () => {
      unsubNew();
      unsubUpdated();
      unsubDeleted();
    };
  }, []);

  const handleSave = async (text: string) => {
    await window.api.capture.save(text);
  };

  const handleDelete = async (id: string) => {
    await window.api.capture.deleteEntry(id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
        <StickyNote className="w-4 h-4 text-accent-warm/50" />
        <h2 className="text-[11px] uppercase tracking-[0.18em] font-medium text-text-muted/50">
          Scratch
        </h2>
      </div>

      {/* Capture bar */}
      <FocusCaptureBar onSave={(text) => void handleSave(text)} />

      {/* Cards */}
      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-6">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-20">
            <div className="text-[12px] text-text-muted text-center leading-relaxed">
              {'\u2318\u21E7'}N to capture
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <FocusCard
                key={entry.id}
                entry={entry}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
