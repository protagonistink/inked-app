// src/components/DeadlineMargin.tsx
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useApp } from '@/context/AppContext';

const LIFE_EVENT_RE = /birthday|party|anniversary|wedding|graduation|holiday|vacation|trip/i;

export function DeadlineMargin({ layout = 'vertical' }: { layout?: 'horizontal' | 'vertical' }) {
  const { countdowns } = useApp();
  const today = new Date();

  const items = countdowns
    .map((c) => ({ ...c, days: differenceInCalendarDays(parseISO(c.dueDate), today) }))
    .filter((c) => c.days >= 0)
    .sort((a, b) => a.days - b.days);

  if (items.length === 0) return null;

  if (layout === 'horizontal') {
    return (
      <div
        className="shrink-0 flex items-center gap-6 overflow-x-auto hide-scrollbar"
        style={{
          borderBottom: '0.5px solid rgba(255,255,255,0.04)',
          padding: '10px 20px',
        }}
      >
        <div
          style={{
            fontSize: 8,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: 'rgba(148,163,184,0.45)',
            whiteSpace: 'nowrap',
          }}
        >
          Upcoming
        </div>
        {items.map((item) => {
          const isLife = LIFE_EVENT_RE.test(item.title);
          return (
            <div key={item.id} className="flex items-baseline gap-2 shrink-0">
              <span
                className="font-display italic text-[14px] leading-none"
                style={{ color: isLife ? 'rgba(110,135,175,0.65)' : 'rgba(190,90,55,0.8)' }}
              >
                {item.days}d
              </span>
              <span
                className="text-[10px] leading-none"
                style={{
                  color: 'rgba(160,150,130,0.5)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 120,
                }}
              >
                {item.title}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical layout (focus mode — 1/3 column)
  return (
    <div
      className="shrink-0 flex flex-col overflow-y-auto hide-scrollbar"
      style={{
        width: '33%',
        minWidth: 140,
        borderLeft: '0.5px solid rgba(255,255,255,0.04)',
        padding: '16px 0 8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontSize: 8,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: 'rgba(130,120,100,0.25)',
          padding: '0 14px 10px',
          whiteSpace: 'nowrap',
        }}
      >
        Upcoming
      </div>
      {items.map((item) => {
        const isLife = LIFE_EVENT_RE.test(item.title);
        return (
          <div
            key={item.id}
            style={{
              padding: '8px 14px',
              borderBottom: '0.5px solid rgba(255,255,255,0.03)',
              overflow: 'hidden',
            }}
          >
            <div
              className="font-display italic text-[16px] leading-none"
              style={{
                color: isLife ? 'rgba(110,135,175,0.65)' : 'rgba(190,90,55,0.8)',
                marginBottom: 3,
                whiteSpace: 'nowrap',
              }}
            >
              {item.days}d
            </div>
            <div
              className="text-[10px] leading-[1.35]"
              style={{
                color: 'rgba(160,150,130,0.5)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.title}
            </div>
          </div>
        );
      })}
    </div>
  );
}