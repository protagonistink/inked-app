import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { DaySwitcherDropdown } from './DaySwitcherDropdown';

export function DateHeader() {
  const { viewDate } = useApp();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative inline-flex flex-col items-start">
      <button
        onClick={() => setOpen((value) => !value)}
        className="group flex flex-col items-start text-left"
      >
        <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-[#919fae]/35">
          {format(viewDate, 'EEEE')}
        </span>
        <span className="mt-1 inline-flex items-center gap-2">
          <span
            className="font-display leading-none"
            style={{ fontSize: '2.75rem', fontWeight: 400, color: '#c8c6c2', letterSpacing: '-0.015em' }}
          >
            {format(viewDate, 'MMMM d')}
          </span>
          <ChevronDown
            className={cn(
              'mt-1 h-4 w-4 text-[#9C9EA2] transition-[transform,color] duration-150 group-hover:text-[#FAFAFA]',
              open && 'rotate-180'
            )}
          />
        </span>
      </button>
      {open && <DaySwitcherDropdown onSelect={() => setOpen(false)} />}
    </div>
  );
}
