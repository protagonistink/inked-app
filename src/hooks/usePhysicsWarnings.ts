import { useEffect, useState, useCallback } from 'react';
import type { ScheduleBlock } from '@/types';
import type { UserPhysics } from '@/types/electron';

interface PhysicsWarningResult {
  getWarning: (block: ScheduleBlock) => string | null;
  physics: UserPhysics | null;
}

export function usePhysicsWarnings(): PhysicsWarningResult {
  const [physics, setPhysics] = useState<UserPhysics | null>(null);

  useEffect(() => {
    window.api.physics.get().then((result) => {
      setPhysics(result.physics);
    }).catch(() => {
      // Physics data unavailable — warnings disabled
    });
  }, []);

  const getWarning = useCallback((block: ScheduleBlock): string | null => {
    if (!physics || block.kind !== 'focus') return null;

    // Parse peakEnergyWindow like "9am-12pm" or "9 AM - 12 PM"
    const peakMatch = physics.peakEnergyWindow.match(/(\d{1,2})\s*([ap]m?)\s*[-–]\s*(\d{1,2})\s*([ap]m?)/i);
    if (peakMatch) {
      let peakStart = parseInt(peakMatch[1], 10);
      let peakEnd = parseInt(peakMatch[3], 10);

      // Convert to 24h
      const startMeridiem = peakMatch[2].toLowerCase();
      const endMeridiem = peakMatch[4].toLowerCase();
      if (startMeridiem.startsWith('p') && peakStart !== 12) peakStart += 12;
      if (startMeridiem.startsWith('a') && peakStart === 12) peakStart = 0;
      if (endMeridiem.startsWith('p') && peakEnd !== 12) peakEnd += 12;
      if (endMeridiem.startsWith('a') && peakEnd === 12) peakEnd = 0;

      const blockStartMins = block.startHour * 60 + block.startMin;
      const blockEndMins = blockStartMins + block.durationMins;
      const peakStartMins = peakStart * 60;
      const peakEndMins = peakEnd * 60;

      // Warn if the block is entirely outside the peak window
      if (blockStartMins >= peakEndMins || blockEndMins <= peakStartMins) {
        return 'Outside peak focus window';
      }
    }

    // Warn if block exceeds ideal focus length by 50%
    if (block.durationMins > physics.focusBlockLength * 1.5) {
      return 'Exceeds ideal focus length';
    }

    return null;
  }, [physics]);

  return { getWarning, physics };
}
