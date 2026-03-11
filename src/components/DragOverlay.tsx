import { useDragLayer } from 'react-dnd';
import { Clock3, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';

function DragGhost({ item, itemType }: { item: DragItem; itemType: string | symbol | null }) {
  const isBlock = itemType === DragTypes.BLOCK || Boolean(item.blockId);

  return (
    <div className="min-w-[220px] max-w-[280px] rounded-2xl border border-white/12 bg-[linear-gradient(180deg,rgba(28,31,38,0.96),rgba(16,18,24,0.98))] px-4 py-3 text-text-primary shadow-[0_32px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-text-muted">
        {isBlock ? <CornerDownLeft className="w-3.5 h-3.5" /> : <Clock3 className="w-3.5 h-3.5" />}
        <span>{isBlock ? 'Returning to Commit' : 'Dropping into Time'}</span>
      </div>
      <div className="mt-2 text-[13px] leading-snug text-text-emphasis">{item.title}</div>
    </div>
  );
}

export function DragOverlay() {
  const { isDragging, itemType, item, clientOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    itemType: monitor.getItemType(),
    item: monitor.getItem() as DragItem | null,
    clientOffset: monitor.getClientOffset(),
  }));

  if (!isDragging || !item || !clientOffset) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]">
      <div
        className={cn('absolute transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)]')}
        style={{
          transform: `translate(${clientOffset.x + 18}px, ${clientOffset.y + 18}px) rotate(-3deg) scale(1.04)`,
        }}
      >
        <DragGhost item={item} itemType={itemType} />
      </div>
    </div>
  );
}
