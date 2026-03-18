import { useEffect, useState } from 'react';

export function useModifierKey(): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.altKey) setHeld(true); };
    const up = (e: KeyboardEvent) => { if (!e.altKey) setHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return held;
}
