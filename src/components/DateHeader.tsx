import { useRef, useState, useCallback } from 'react';
import { format, addDays, subDays, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlanner } from '@/context/AppContext';

const SLIDE_DISTANCE = 80;
const SLIDE_DURATION = 0.2;

function formatEditorialWeekday(date: Date) {
  const abbreviated = format(date, 'EEE');
  if (abbreviated === 'Tue') return 'Tues';
  if (abbreviated === 'Thu') return 'Thurs';
  return abbreviated;
}

export function DateHeader() {
  const { viewDate, setViewDate } = usePlanner();
  const [direction, setDirection] = useState(0);
  const directionRef = useRef(0);

  const yesterday = subDays(viewDate, 1);
  const tomorrow = addDays(viewDate, 1);

  const goBack = useCallback(() => {
    directionRef.current = -1;
    setDirection(-1);
    setViewDate(subDays(viewDate, 1));
  }, [viewDate, setViewDate]);

  const goForward = useCallback(() => {
    directionRef.current = 1;
    setDirection(1);
    setViewDate(addDays(viewDate, 1));
  }, [viewDate, setViewDate]);

  const goToToday = useCallback(() => {
    if (isToday(viewDate)) return;
    const today = new Date();
    directionRef.current = today > viewDate ? 1 : -1;
    setDirection(directionRef.current);
    setViewDate(today);
  }, [viewDate, setViewDate]);

  const variants = {
    enter: (dir: number) => ({
      x: dir * SLIDE_DISTANCE,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir * -SLIDE_DISTANCE,
      opacity: 0,
    }),
  };

  return (
    <div className="relative flex items-center justify-center w-full border-b border-border-subtle px-6 py-4 select-none overflow-hidden">
      {/* Left chevron */}
      <button
        onClick={goBack}
        className="z-10 rounded-md p-2 text-text-secondary/30 transition-colors hover:bg-surface hover:text-text-secondary select-none"
        aria-label="Previous day"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={viewDate.toISOString()}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: SLIDE_DURATION, ease: 'easeInOut' }}
          className="flex items-center"
        >
          {/* Yesterday */}
          <button
            onClick={goBack}
            className="flex min-w-[84px] flex-col items-center rounded-md px-2 py-1 opacity-35 transition-opacity hover:bg-surface hover:opacity-60 select-none"
          >
            <span className="ui-meta-label font-sans">
              {formatEditorialWeekday(yesterday)}
            </span>
            <span className="mt-1 text-[24px] font-medium tracking-[-0.03em] text-text-secondary">
              {format(yesterday, 'd')}
            </span>
          </button>

          {/* Today (hero) */}
          <button
            onClick={goToToday}
            className="mx-4 flex flex-col items-center rounded-md px-8 py-1 select-none"
          >
            <span className="text-[30px] font-medium text-text-emphasis tracking-[-0.04em] leading-none">
              {format(viewDate, 'EEEE')}
            </span>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-accent-warm/85 font-sans">
              {format(viewDate, 'MMM d')}
            </span>
          </button>

          {/* Tomorrow */}
          <button
            onClick={goForward}
            className="flex min-w-[84px] flex-col items-center rounded-md px-2 py-1 opacity-35 transition-opacity hover:bg-surface hover:opacity-60 select-none"
          >
            <span className="ui-meta-label font-sans">
              {formatEditorialWeekday(tomorrow)}
            </span>
            <span className="mt-1 text-[24px] font-medium tracking-[-0.03em] text-text-secondary">
              {format(tomorrow, 'd')}
            </span>
          </button>
        </motion.div>
      </AnimatePresence>

      {/* Right chevron */}
      <button
        onClick={goForward}
        className="z-10 rounded-md p-2 text-text-secondary/30 transition-colors hover:bg-surface hover:text-text-secondary select-none"
        aria-label="Next day"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
