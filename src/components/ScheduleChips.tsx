// src/components/ScheduleChips.tsx
import { useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleChip } from '@/components/ink/morningBriefingUtils';
import { formatTime } from '@/components/timeline/timelineUtils';

const CHIP_TYPE = 'SCHEDULE_CHIP';

function DraggableChip({
  chip,
  index,
  totalChips,
  onToggle,
  onReorder,
}: {
  chip: ScheduleChip;
  index: number;
  totalChips: number;
  onToggle: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: CHIP_TYPE,
    item: { index },
    canDrag: totalChips >= 2,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver, dragIndex }, drop] = useDrop({
    accept: CHIP_TYPE,
    drop(item: { index: number }) {
      if (item.index !== index) onReorder(item.index, index);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      dragIndex: (monitor.getItem() as { index: number } | null)?.index ?? null,
    }),
  });

  drag(drop(ref));

  const dropPosition =
    isOver && dragIndex !== null && dragIndex !== index
      ? dragIndex > index
        ? 'above'
        : 'below'
      : null;

  const timeLabel = formatTime(chip.startHour, chip.startMin);
  const endTotalMins = chip.startHour * 60 + chip.startMin + chip.durationMins;
  const endLabel = formatTime(Math.floor(endTotalMins / 60), endTotalMins % 60);

  const dropLine = (
    <div
      style={{
        height: 2,
        background: 'var(--color-accent-warm)',
        borderRadius: 2,
        margin: '2px 0',
      }}
    />
  );

  return (
    <>
      {dropPosition === 'above' && dropLine}
      <button
        ref={ref}
        onClick={() => onToggle(index)}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 text-left transition-all text-[13px]',
          chip.selected ? 'border' : 'border border-transparent'
        )}
        style={{
          borderRadius: 16,
          borderLeftWidth: 3,
          borderLeftStyle: 'solid',
          borderLeftColor: chip.selected ? 'var(--color-accent-warm)' : 'var(--color-text-muted)',
          borderColor: chip.selected ? 'rgba(200,60,47,0.3)' : 'transparent',
          background: chip.selected ? 'var(--color-bg-chip-selected, rgba(200,60,47,0.15))' : 'var(--color-bg-chip)',
          color: chip.selected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          opacity: isDragging ? 0.4 : 1,
          cursor: totalChips >= 2 ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
      >
        <div
          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
          style={{
            borderColor: chip.selected ? 'var(--color-accent-warm)' : 'var(--color-text-muted)',
            background: chip.selected ? 'var(--color-accent-warm)' : 'transparent',
          }}
        >
          {chip.selected && <Check className="w-2.5 h-2.5 text-white" />}
        </div>
        <span className="flex-1 min-w-0 truncate">{chip.title}</span>
        <span className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: 'var(--color-text-muted)' }}>
          <Clock className="w-3 h-3" />
          {timeLabel}–{endLabel}
        </span>
      </button>
      {dropPosition === 'below' && dropLine}
    </>
  );
}

export function ScheduleChips({
  chips,
  proposalLabel,
  isOverlay,
  onToggle,
  onExecute,
  onReorder,
}: {
  chips: ScheduleChip[];
  proposalLabel: string;
  isOverlay: boolean;
  onToggle: (index: number) => void;
  onExecute: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col gap-2 mt-2">
        <div
          className="text-[10px] uppercase tracking-[0.14em] font-medium px-1"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Proposed schedule for {proposalLabel}
        </div>
        {chips.map((chip, i) => (
          <DraggableChip
            key={chip.id}
            chip={chip}
            index={i}
            totalChips={chips.length}
            onToggle={onToggle}
            onReorder={onReorder}
          />
        ))}
        <button
          onClick={onExecute}
          disabled={chips.every((c) => !c.selected)}
          className={cn(
            'mt-2 rounded-lg text-[13px] font-medium transition-all',
            isOverlay ? 'px-3.5 py-2' : 'px-4 py-2'
          )}
          style={{
            background: chips.some((c) => c.selected)
              ? 'var(--color-accent-warm)'
              : 'var(--color-bg-elevated)',
            color: chips.some((c) => c.selected)
              ? 'var(--color-text-on-accent)'
              : 'var(--color-text-muted)',
            cursor: chips.some((c) => c.selected) ? 'pointer' : 'not-allowed',
          }}
        >
          Lock it in
        </button>
      </div>
    </DndProvider>
  );
}
