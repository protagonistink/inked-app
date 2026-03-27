import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useGravity } from '@/hooks/useGravity';

interface GravityContextValue {
  active: boolean;
  staleGoalId: string | null;
  staleGoalTitle: string | null;
  daysSinceActivity: number;
  invokeAnarchy: () => void;
  releaseGravity: () => void;
  todayAnarchy: boolean;
}

const GravityContext = createContext<GravityContextValue>({
  active: false,
  staleGoalId: null,
  staleGoalTitle: null,
  daysSinceActivity: 0,
  invokeAnarchy: () => {},
  releaseGravity: () => {},
  todayAnarchy: false,
});

export function GravityProvider({ children }: { children: ReactNode }) {
  const gravity = useGravity();

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-gravity',
      gravity.active ? 'active' : 'released'
    );
  }, [gravity.active]);

  return (
    <GravityContext.Provider value={gravity}>
      {children}
    </GravityContext.Provider>
  );
}

export function useGravityContext() {
  return useContext(GravityContext);
}
