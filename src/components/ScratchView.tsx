import { useState, useEffect, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { X, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScratchEntry } from '@/types/electron';

/* ── Inline capture bar (Keep-style) ── */

function CaptureBar({ onSave }: { onSave: (text: string) => void }) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSave(value.trim());
    setValue('');
    setFocused(false);
    textareaRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setValue('');
      setFocused(false);
      textareaRef.current?.blur();
    }
  };

  return (
    <div
      className={cn(
        'max-w-xl mx-auto mb-8 rounded-xl border transition-all duration-200',
        focused
          ? 'bg-white/[0.04] border-white/[0.12] shadow-lg shadow-black/20'
          : 'bg-white/[0.02] border-white/[0.07] hover:border-white/[0.10]'
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { if (!value.trim()) setFocused(false); }}
        onKeyDown={handleKeyDown}
        placeholder="Take a note..."
        rows={focused ? 3 : 1}
        className={cn(
          'w-full bg-transparent border-none outline-none resize-none px-4 text-[14px] leading-relaxed text-text-primary/90 placeholder:text-text-muted/30',
          focused ? 'py-3' : 'py-3'
        )}
        style={{ caretColor: 'rgba(190,90,55,0.9)' }}
      />
      {focused && (
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="text-[10px] tracking-[0.1em] uppercase text-text-muted/30">
            Enter to save
          </div>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="text-[11px] tracking-wider uppercase px-3 py-1 rounded-md text-accent-warm/80 hover:bg-accent-warm/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Expanded note editor (Evernote-simplified) ── */

function NoteEditor({
  entry,
  onClose,
  onUpdate,
  onDelete,
}: {
  entry: ScratchEntry;
  onClose: () => void;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}) {
  const [text, setText] = useState(entry.text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    // Place cursor at end
    const el = textareaRef.current;
    if (el) {
      el.selectionStart = el.value.length;
      el.selectionEnd = el.value.length;
    }
  }, []);

  // Auto-save on close
  const handleClose = useCallback(() => {
    if (text.trim() !== entry.text) {
      onUpdate(entry.id, text);
    }
    onClose();
  }, [text, entry, onUpdate, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-2xl bg-[#1a1a1c] border border-white/[0.10] rounded-xl shadow-2xl shadow-black/40 flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Editor body */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 w-full bg-transparent border-none outline-none resize-none px-6 py-5 text-[15px] leading-[1.8] text-text-primary/90 placeholder:text-text-muted/30 min-h-[200px]"
          style={{ caretColor: 'rgba(190,90,55,0.9)' }}
        />

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/[0.06]">
          <div className="text-[11px] text-text-muted/30 tracking-[0.06em]">
            {format(parseISO(entry.createdAt), 'h:mm a')}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onDelete(entry.id); onClose(); }}
              className="text-[11px] tracking-wider uppercase px-3 py-1.5 rounded-md text-text-muted/40 hover:text-red-400/70 hover:bg-red-400/10 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={handleClose}
              className="text-[11px] tracking-wider uppercase px-3 py-1.5 rounded-md text-accent-warm/70 hover:bg-accent-warm/10 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Keep-style masonry card ── */

function ScratchCard({
  entry,
  onClick,
  onDelete,
}: {
  entry: ScratchEntry;
  onClick: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group relative rounded-xl px-4 py-3.5 cursor-pointer transition-all duration-150 break-inside-avoid mb-3 bg-[#1c1b19]/60 border border-amber-900/[0.08] hover:bg-[#1c1b19]/80 hover:border-amber-900/[0.14] bg-gradient-to-br from-[#1d1c19]/60 via-[#1a1917]/60 to-[#1c1b18]/60"
      style={{
        backgroundImage: `
          linear-gradient(135deg, rgba(255,248,230,0.012) 0%, transparent 50%, rgba(255,248,230,0.008) 100%),
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E")
        `,
      }}
    >
      <div className="text-[13px] leading-[1.7] text-text-primary/80 whitespace-pre-wrap break-words line-clamp-[12]">
        {entry.text}
      </div>
      <div className="mt-2.5 text-[10px] tracking-[0.08em] text-text-muted/25">
        {format(parseISO(entry.createdAt), 'h:mm a')}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); void onDelete(entry.id); }}
        className="absolute top-2.5 right-2.5 p-1 text-text-muted/0 group-hover:text-text-muted/30 hover:!text-text-muted/70 transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  );
}

/* ── Main view ── */

export function ScratchView() {
  const [entries, setEntries] = useState<ScratchEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<ScratchEntry | null>(null);

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

  const handleUpdate = async (id: string, text: string) => {
    await window.api.capture.update(id, text);
  };

  const handleDelete = async (id: string) => {
    await window.api.capture.deleteEntry(id);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto hide-scrollbar">
      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* Capture bar */}
        <CaptureBar onSave={(text) => void handleSave(text)} />

        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-25">
            <StickyNote className="w-8 h-8 text-text-muted" />
            <div className="text-[13px] text-text-muted text-center leading-relaxed">
              No captures yet today.
              <br />
              Type above or press {'\u2318\u21E7'}N from anywhere.
            </div>
          </div>
        ) : (
          /* Masonry grid via CSS columns */
          <div className="columns-2 lg:columns-3 gap-3">
            {entries.map((entry) => (
              <ScratchCard
                key={entry.id}
                entry={entry}
                onClick={() => setEditingEntry(entry)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Expanded editor overlay */}
      {editingEntry && (
        <NoteEditor
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onUpdate={(id, text) => void handleUpdate(id, text)}
          onDelete={(id) => void handleDelete(id)}
        />
      )}
    </div>
  );
}
