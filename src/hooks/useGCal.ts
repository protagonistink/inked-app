import { useState, useEffect, useCallback } from 'react';
import type { GCalEvent, ScheduleBlock } from '@/types';
import { format } from 'date-fns';

export function useGCal(date: Date = new Date()) {
  const [events, setEvents] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const result = await window.api.gcal.getEvents(dateStr);
      if (result.success && result.data) {
        const blocks: ScheduleBlock[] = result.data
          .filter((event): event is GCalEvent & { start: { dateTime: string }; end: { dateTime: string } } => Boolean(event.start?.dateTime && event.end?.dateTime))
          .map((event) => {
            const start = new Date(event.start.dateTime);
            const end = new Date(event.end.dateTime);
            const durationMins = (end.getTime() - start.getTime()) / 60000;

            return {
              id: event.id,
              title: event.summary || 'Untitled',
              startHour: start.getHours(),
              startMin: start.getMinutes(),
              durationMins,
              kind: 'hard' as const,
              readOnly: true,
              eventId: event.id,
              source: 'gcal' as const,
            };
          });
        setEvents(blocks);
      } else {
        setError(result.error || 'Failed to fetch events');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const createEvent = useCallback(
    async (block: ScheduleBlock) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const startTime = `${dateStr}T${String(block.startHour).padStart(2, '0')}:${String(block.startMin).padStart(2, '0')}:00`;
      const endHour = block.startHour + Math.floor((block.startMin + block.durationMins) / 60);
      const endMin = (block.startMin + block.durationMins) % 60;
      const endTime = `${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;

      const event = {
        summary: block.title,
        start: { dateTime: startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      };

      const result = await window.api.gcal.createEvent(event);
      if (result.success) {
        fetchEvents(); // refresh
      }
      return result;
    },
    [date, fetchEvents]
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents, createEvent };
}
