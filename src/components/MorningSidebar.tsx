import { format, differenceInDays, parseISO, startOfDay } from 'date-fns';
import { useApp } from '@/context/AppContext';

function formatBlockTime(hour: number, min: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:${String(min).padStart(2, '0')} ${period}`;
}

export function MorningSidebar() {
  const {
    scheduleBlocks,
    countdowns,
    workdayStart,
    workdayEnd,
  } = useApp();

  const today = new Date();
  // Calendar events from gcal
  const calendarEvents = scheduleBlocks
    .filter((b) => b.source === 'gcal')
    .sort((a, b) => a.startHour * 60 + a.startMin - (b.startHour * 60 + b.startMin));

  // Upcoming countdowns
  const upcomingCountdowns = countdowns
    .filter((c) => parseISO(c.dueDate) >= startOfDay(today))
    .sort((a, b) => parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime());

  const startTime = formatBlockTime(workdayStart.hour, workdayStart.min);
  const endTime = formatBlockTime(workdayEnd.hour, workdayEnd.min);

  return (
    <aside
      className="w-[350px] shrink-0 flex flex-col overflow-y-auto hide-scrollbar"
      style={{
        borderLeft: '1px solid #1E293B',
        padding: '2rem 1.75rem',
        lineHeight: '1.6',
      }}
    >
      {/* Today */}
      <div className="mb-8">
        <h3
          className="text-[10px] uppercase tracking-widest mb-3"
          style={{ color: '#64748B' }}
        >
          Today
        </h3>
        <p className="text-[15px] font-medium" style={{ color: '#E2E8F0' }}>
          {format(today, 'EEEE, MMMM d')}
        </p>
        <p className="text-[12px] mt-1" style={{ color: '#475569' }}>
          {startTime} &ndash; {endTime}
        </p>
      </div>

      {/* On The Calendar */}
      <div className="mb-8">
        <h3
          className="text-[10px] uppercase tracking-widest mb-4"
          style={{ color: '#64748B' }}
        >
          On the Calendar
        </h3>
        <div className="flex flex-col gap-6">
          {calendarEvents.length > 0 ? (
            calendarEvents.map((event) => {
              const endMin = event.startHour * 60 + event.startMin + event.durationMins;
              const endHour = Math.floor(endMin / 60);
              const endMinRemainder = endMin % 60;
              return (
                <div key={event.id}>
                  <p className="text-[13px]" style={{ color: '#E2E8F0' }}>
                    {event.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
                    {formatBlockTime(event.startHour, event.startMin)} &ndash;{' '}
                    {formatBlockTime(endHour, endMinRemainder)}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-[12px] italic" style={{ color: '#475569' }}>
              Nothing on the calendar today.
            </p>
          )}
        </div>
      </div>

      {/* Awareness */}
      {upcomingCountdowns.length > 0 && (
        <div className="mb-8">
          <h3
            className="text-[10px] uppercase tracking-widest mb-4"
            style={{ color: '#64748B' }}
          >
            Awareness
          </h3>
          <div className="flex flex-col gap-6">
            {upcomingCountdowns.map((countdown) => {
              const daysUntil = differenceInDays(parseISO(countdown.dueDate), startOfDay(today));
              const label = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d away`;
              return (
                <div key={countdown.id} className="flex items-start gap-2.5">
                  <span
                    className="w-1 h-1 rounded-full mt-[7px] shrink-0"
                    style={{ background: '#475569' }}
                  />
                  <div>
                    <p className="text-[12px]" style={{ color: '#E2E8F0' }}>
                      {countdown.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
                      {label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </aside>
  );
}
