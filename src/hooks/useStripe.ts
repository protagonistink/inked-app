import { useState, useCallback, useEffect } from 'react';
import { withTimeout } from '@/lib/ipc';

export interface StripeDashboard {
  received: number;
  pending: number;
  overdue: number;
  upcoming: number;
  availableBalance: number;
  pendingBalance: number;
  recentCharges: Array<{
    id: string;
    amount: number;
    description: string | null;
    created: number;
    status: string;
    customerEmail: string | null;
  }>;
  openInvoices: Array<{
    id: string;
    amount: number;
    description: string | null;
    dueDate: number | null;
    status: string;
    customerEmail: string | null;
    isOverdue: boolean;
  }>;
}

export function useStripe() {
  const [dashboard, setDashboard] = useState<StripeDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await withTimeout(window.api.stripe.getDashboard(), 'stripe.getDashboard');
      if (result.success && result.data) {
        setDashboard(result.data);
      } else {
        setError(result.error ?? 'Failed to fetch Stripe data');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { dashboard, loading, error, refresh: fetchDashboard };
}
