// src/components/AIBreakdown.tsx
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import type { ScheduleBlock } from '@/types';

export function AIBreakdown({ block }: { block: ScheduleBlock }) {
  const [expanded, setExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { nestTask, addLocalTask } = useApp();

  async function fetchBreakdown() {
    setExpanded(true);
    if (suggestions.length > 0) return;
    setLoading(true);
    try {
      const res = await window.api.ai.chat(
        [{ role: 'user', content: `Break down "${block.title}" into 3-5 concrete sub-tasks. Return ONLY a numbered list, no preamble.` }],
        {} as any
      );
      if (res.success && res.content) {
        const lines = res.content.split('\n')
          .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
          .filter(l => l.length > 0);
        setSuggestions(lines.slice(0, 5));
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  function toggleItem(item: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  function inkSelected() {
    for (const item of selected) {
      if (block.linkedTaskId) {
        const taskId = addLocalTask(item);
        if (taskId) nestTask(taskId, block.linkedTaskId);
      }
    }
    setSelected(new Set());
    setExpanded(false);
  }

  return (
    <div className="mt-3">
      {!expanded ? (
        <button
          onClick={(e) => { e.stopPropagation(); fetchBreakdown(); }}
          className="font-sans text-[11px] text-[#919fae]/40 hover:text-[#919fae]/70 transition-colors"
        >
          ✨ AI Breakdown
        </button>
      ) : (
        <div className="pt-3" style={{ borderTop: '1px solid rgba(250,250,250,0.05)' }}>
          <span className="font-sans text-[9px] tracking-[0.18em] uppercase text-[#919fae]/28 block mb-3">
            Ink suggests from Asana
          </span>
          {loading ? (
            <span className="text-[11px] text-text-muted/30">Thinking...</span>
          ) : (
            <>
              {suggestions.map((item) => (
                <div
                  key={item}
                  className={cn('triage-row', selected.has(item) && 'selected')}
                  onClick={(e) => { e.stopPropagation(); toggleItem(item); }}
                >
                  <div className="triage-box" />
                  <span>{item}</span>
                </div>
              ))}
              {selected.size > 0 && (
                <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid rgba(250,250,250,0.04)' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); inkSelected(); }}
                    className="font-sans text-[13px] text-[#E55547]/65 hover:text-[#E55547]/90 transition-colors cursor-pointer font-medium"
                  >
                    Ink it →
                  </button>
                  <span className="text-text-muted/20 text-[10px]">·</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                    className="font-sans text-[11px] text-text-muted/30 hover:text-text-muted/50 transition-colors cursor-pointer"
                  >
                    skip for now
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
