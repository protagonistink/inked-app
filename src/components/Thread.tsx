import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';

interface Endpoints {
  taskX: number;
  taskY: number;
  blockX: number;
  blockY: number;
}

export function InkThread() {
  const { currentTask } = useApp();
  const [endpoints, setEndpoints] = useState<Endpoints | null>(null);
  const rafRef = useRef(0);

  const activeTaskId = currentTask?.id ?? null;

  useEffect(() => {
    if (!activeTaskId) {
      setEndpoints(null);
      return;
    }

    function measure() {
      // Source: prefer the TaskCard in Today's Commit, fall back to the status bar
      const taskCardEl = document.querySelector(`[data-task-id="${activeTaskId}"]`);
      const statusBarEl = document.querySelector(`[data-thread-source="${activeTaskId}"]`);
      const sourceEl = taskCardEl || statusBarEl;

      // Target: the BlockCard on the Timeline (has data-task-id but lives in
      // the timeline scroll area — distinguish by checking for a second match)
      let blockEl: Element | undefined;

      if (taskCardEl) {
        // TaskCard found — look for a DIFFERENT element with the same data-task-id
        const allEls = document.querySelectorAll(`[data-task-id="${activeTaskId}"]`);
        allEls.forEach((el) => {
          if (el !== taskCardEl) blockEl = el;
        });
      } else if (statusBarEl) {
        // Fell back to status bar — any data-task-id match IS the block
        const blockMatch = document.querySelector(`[data-task-id="${activeTaskId}"]`);
        if (blockMatch) blockEl = blockMatch;
      }

      if (!sourceEl || !blockEl) {
        setEndpoints(null);
        return;
      }

      const sourceRect = sourceEl.getBoundingClientRect();
      const blockRect = blockEl.getBoundingClientRect();

      setEndpoints({
        taskX: sourceRect.right,
        taskY: sourceRect.top + sourceRect.height / 2,
        blockX: blockRect.left,
        blockY: blockRect.top + blockRect.height / 2,
      });
    }

    // Initial measure
    measure();

    // Re-measure on scroll and resize
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        measure();
        rafRef.current = 0;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // ResizeObserver for layout shifts
    const observer = new ResizeObserver(onScroll);
    observer.observe(document.body);

    // Re-measure periodically to catch DOM updates (task selection changes)
    const interval = setInterval(measure, 500);

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      observer.disconnect();
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [activeTaskId]);

  if (!endpoints) return null;

  const { taskX, taskY, blockX, blockY } = endpoints;

  // Horizontal distance for cubic bezier control points
  const dx = Math.abs(blockX - taskX);
  const cpOffset = Math.max(40, dx * 0.45);

  const path = `M ${taskX} ${taskY} C ${taskX + cpOffset} ${taskY}, ${blockX - cpOffset} ${blockY}, ${blockX} ${blockY}`;

  return (
    <svg className="pointer-events-none fixed inset-0 z-[100]" width="100%" height="100%">
      <defs>
        <filter id="thread-glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Outer glow */}
      <path
        d={path}
        fill="none"
        stroke="var(--color-accent-cobalt)"
        strokeWidth="2"
        strokeOpacity="0.25"
        filter="url(#thread-glow)"
        className="transition-all duration-500"
      />
      {/* Core line */}
      <path
        d={path}
        fill="none"
        stroke="var(--color-accent-cobalt)"
        strokeWidth="1"
        strokeOpacity="0.40"
        className="transition-all duration-500"
      />
    </svg>
  );
}
