import { useState, useCallback, useEffect } from 'react';
import type { EngineState } from '../../engine/types';
import { withTimeout } from '@/lib/ipc';

interface ActionItem {
  id: string;
  description: string;
  status: string;
  dueDate: string | null;
  amount: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  available_balance: number;
  institution: string;
  last_synced: string;
}

export function useFinance() {
  const [state, setState] = useState<EngineState | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const processResult = useCallback((result: unknown) => {
    if (!result || typeof result !== 'object') return;
    const data = result as EngineState & { actionItems?: ActionItem[] };
    const { actionItems: items, ...engine } = data;
    setState(engine as EngineState);
    if (Array.isArray(items)) setActionItems(items);
  }, []);

  const fetchState = useCallback(async () => {
    setLoading(true);
    try {
      const [result, accts] = await Promise.all([
        withTimeout(window.api.finance.getState(), 'finance.getState'),
        withTimeout(window.api.finance.getAccounts(), 'finance.getAccounts').catch(() => []),
      ]);
      processResult(result);
      if (Array.isArray(accts)) setAccounts(accts);
    } catch (error) {
      console.error('Failed to fetch finance state:', error);
    } finally {
      setLoading(false);
    }
  }, [processResult]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await withTimeout(window.api.finance.refresh(), 'finance.refresh', 15_000);
      processResult(result);
      // Also refresh accounts after sync
      const accts = await withTimeout(window.api.finance.getAccounts(), 'finance.getAccounts').catch(() => []);
      if (Array.isArray(accts)) setAccounts(accts);
    } catch (error) {
      console.error('Failed to refresh finance state:', error);
    } finally {
      setLoading(false);
    }
  }, [processResult]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  return { state, actionItems, accounts, loading, refresh };
}
