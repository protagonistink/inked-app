import { useState, useEffect, useCallback } from 'react';
import type { AsanaTask, InboxItem } from '@/types';

export function useAsana() {
  const [tasks, setTasks] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.api.asana.getTasks();
      if (result.success && result.data) {
        const items: InboxItem[] = result.data.map((task: AsanaTask) => {
          const priority = task.custom_fields?.find(
            (field) => field.name?.toLowerCase() === 'priority'
          )?.display_value;

          return {
            id: task.gid,
            source: 'asana' as const,
            title: task.name,
            time: task.due_on
              ? new Date(task.due_on).toLocaleDateString() === new Date().toLocaleDateString()
                ? 'Today'
                : new Date(task.due_on).toLocaleDateString()
              : 'No date',
            priority: priority || undefined,
          };
        });
        setTasks(items);
      } else {
        setError(result.error || 'Failed to fetch tasks');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, refetch: fetchTasks };
}
