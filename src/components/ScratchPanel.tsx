import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { X, StickyNote } from 'lucide-react';
import type { ScratchEntry } from '@/types/electron';

const PAPER_TEXTURE_STYLE = {
  backgroundImage: `
    linear-gradient(135deg, rgba(255,248,230,0.012) 0%, transparent 50%, rgba(255,248,230,0.008) 100%),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E")
  `,
};

export function ScratchPanel() {
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

  const handleDelete = async (id: string) => {
    await window.api.capture.deleteEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2.5 px-6 pt-5 pb-3">
          <StickyNote className="w-4 h-4 text-accent-warm/50" />
          <h2 className="text-[11px] uppercase tracking-[0.18em] font-medium text-text-muted/50">
            Scratch
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-2 opacity-25">
          <div className="text-[12px] text-text-muted/70">
            {'\u2318\u21E7'}N to capture
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-6 pt-5 pb-3">
        <StickyNote className="w-4 h-4 text-accent-warm/50" />
        <h2 className="text-[11px] uppercase tracking-[0.18em] font-medium text-text-muted/50">
          Scratch
        </h2>
      </div>
      <div className="flex flex-col gap-2 px-6 pb-6 overflow-y-auto flex-1 hide-scrollbar">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="group relative rounded-lg px-3.5 py-3 pr-9 bg-[#1c1b19]/60 border border-amber-900/[0.08] hover:bg-[#1c1b19]/80 hover:border-amber-900/[0.14] transition-colors bg-gradient-to-br from-[#1d1c19]/60 via-[#1a1917]/60 to-[#1c1b18]/60"
            style={PAPER_TEXTURE_STYLE}
          >
            <div className="text-[13px] leading-relaxed text-text-primary/85 whitespace-pre-wrap break-words">
              {entry.text}
            </div>
            <div className="mt-1.5 text-[10px] tracking-[0.08em] text-text-muted/25">
              {format(parseISO(entry.createdAt), 'h:mm a')}
            </div>
            <button
              onClick={() => void handleDelete(entry.id)}
              className="absolute top-2.5 right-2.5 p-0.5 text-text-muted/0 group-hover:text-text-muted/30 hover:!text-text-muted/70 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
