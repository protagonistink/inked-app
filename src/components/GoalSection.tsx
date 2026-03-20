import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { useDrop } from 'react-dnd';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import type { PlannedTask, WeeklyGoal } from '@/types';
import { TaskCard, type DeadlineState } from './TaskCard';

export function GoalSection({
  goal,
  goalIndex = -1,
  tasks,
  startIndex,
  actualByTask,
  allDaySubtasks,
  nestTask,
  unnestTask,
  deadlineInfo,
  isFirst = false,
  nestedInBlockIds,
}: {
  goal: WeeklyGoal;
  goalIndex?: number;
  tasks: PlannedTask[];
  startIndex: number;
  actualByTask: Map<string, number>;
  allDaySubtasks: PlannedTask[];
  nestTask: (childId: string, parentId: string) => void;
  unnestTask: (childId: string) => void;
  deadlineInfo?: { daysRemaining: number; state: DeadlineState };
  isFirst?: boolean;
  nestedInBlockIds?: Set<string>;
}) {
  const { bringForward, unscheduleTaskBlock } = useApp();
  const finishedCount = tasks.filter((task) => task.status === 'done').length;

  const subtasksByParent = useMemo(() => {
    const map = new Map<string, PlannedTask[]>();
    for (const sub of allDaySubtasks) {
      if (!sub.parentId) continue;
      const existing = map.get(sub.parentId) ?? [];
      map.set(sub.parentId, [...existing, sub]);
    }
    return map;
  }, [allDaySubtasks]);

  const [{ isOver }, dropRef] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: [DragTypes.TASK, DragTypes.BLOCK],
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
    drop: (item) => {
      // bringForward handles both committing candidates and re-assigning already-committed tasks
      if (item.blockId) {
        void unscheduleTaskBlock(item.blockId, goal.id);
        return;
      }
      bringForward(item.id, goal.id);
    },
  });

  return (
    <div
      ref={dropRef}
      className={cn(
        'flex flex-col gap-3 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        isOver && 'bg-accent-warm/[0.07] px-3 py-3 -mx-3'
      )}
      style={!isFirst ? { borderTop: '0.5px solid rgba(255,255,255,0.06)' } : undefined}
    >
      <div style={{ padding: '18px 16px 8px' }}>
        <div className="flex items-center justify-between">
          <div
            className="font-medium"
            style={{
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase' as const,
              color: 'rgba(190,90,55,0.45)',
              marginBottom: 5,
            }}
          >
            Intention
          </div>
          {tasks.length > 0 && (
            <span className="text-[10px] font-mono" style={{ color: 'rgba(140,130,110,0.25)' }}>
              {finishedCount}/{tasks.length}
            </span>
          )}
        </div>
        <h3
          className="font-display text-[15px] leading-[1.3]"
          style={{ color: 'rgba(225,215,200,0.88)', letterSpacing: '-0.01em' }}
        >
          {goal.title}
        </h3>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <div className={cn(
            'mx-1 rounded-lg border border-dashed px-3 py-3 text-center text-[11px] transition-all duration-200',
            isOver
              ? 'border-accent-warm/40 text-accent-warm'
              : 'border-text-muted/15 text-text-muted/25'
          )}>
            {isOver ? 'Release it here.' : 'No tasks yet — drag one in'}
          </div>
        ) : (
          tasks.map((task, i) => (
            <div key={task.id} className="relative">
              {nestedInBlockIds?.has(task.id) && (
                <span className="absolute top-0 right-2 z-10 text-[9px] uppercase tracking-[0.14em] text-text-muted/30">in block</span>
              )}
              <TaskCard
                task={task}
                index={startIndex + i}
                goalIndex={goalIndex}
                actualMins={actualByTask.get(task.id) ?? 0}
                subtasks={subtasksByParent.get(task.id) ?? []}
                nestTask={nestTask}
                unnestTask={unnestTask}
                deadlineInfo={deadlineInfo}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
