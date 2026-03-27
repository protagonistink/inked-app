import { describe, it, expect } from 'vitest';
import { computeGravityState, type GravityInput } from './useGravity';

describe('computeGravityState', () => {
  const baseInput: GravityInput = {
    attentionData: [],
    todayTimeLogs: [],
    todayAnarchy: false,
    weekendGravity: true,
    isWeekend: false,
    weeklyModeActive: true,
  };

  it('returns inactive when no intentions exist', () => {
    const result = computeGravityState(baseInput);
    expect(result.active).toBe(false);
    expect(result.staleGoalId).toBeNull();
  });

  it('returns inactive when all intentions are warm', () => {
    const result = computeGravityState({
      ...baseInput,
      attentionData: [
        { goalId: 'g1', energyLevel: 'warm', daysSinceLastActivity: 0, tasksThisWeek: 5, tasksDone: 3 },
      ],
    });
    expect(result.active).toBe(false);
  });

  it('activates for the quietest intention', () => {
    const result = computeGravityState({
      ...baseInput,
      attentionData: [
        { goalId: 'g1', energyLevel: 'warm', daysSinceLastActivity: 0, tasksThisWeek: 5, tasksDone: 3 },
        { goalId: 'g2', energyLevel: 'quiet', daysSinceLastActivity: 4, tasksThisWeek: 10, tasksDone: 1 },
        { goalId: 'g3', energyLevel: 'quiet', daysSinceLastActivity: 6, tasksThisWeek: 8, tasksDone: 0 },
      ],
    });
    expect(result.active).toBe(true);
    expect(result.staleGoalId).toBe('g3');
  });

  it('skips intentions at or above 40% satisfaction', () => {
    const result = computeGravityState({
      ...baseInput,
      attentionData: [
        { goalId: 'g1', energyLevel: 'quiet', daysSinceLastActivity: 5, tasksThisWeek: 10, tasksDone: 4 },
      ],
    });
    expect(result.active).toBe(false);
  });

  it('releases when anarchy is true', () => {
    const result = computeGravityState({
      ...baseInput,
      todayAnarchy: true,
      attentionData: [
        { goalId: 'g1', energyLevel: 'quiet', daysSinceLastActivity: 5, tasksThisWeek: 10, tasksDone: 1 },
      ],
    });
    expect(result.active).toBe(false);
  });

  it('releases when today has a focus log for the stale goal >= 5 min', () => {
    const result = computeGravityState({
      ...baseInput,
      attentionData: [
        { goalId: 'g1', energyLevel: 'quiet', daysSinceLastActivity: 5, tasksThisWeek: 10, tasksDone: 1 },
      ],
      todayTimeLogs: [
        { objectiveId: 'g1', durationMins: 6 },
      ],
    });
    expect(result.active).toBe(false);
  });

  it('does not release for focus log under 5 min', () => {
    const result = computeGravityState({
      ...baseInput,
      attentionData: [
        { goalId: 'g1', energyLevel: 'quiet', daysSinceLastActivity: 5, tasksThisWeek: 10, tasksDone: 1 },
      ],
      todayTimeLogs: [
        { objectiveId: 'g1', durationMins: 3 },
      ],
    });
    expect(result.active).toBe(true);
  });

  it('respects weekend setting', () => {
    const result = computeGravityState({
      ...baseInput,
      isWeekend: true,
      weekendGravity: false,
      attentionData: [
        { goalId: 'g1', energyLevel: 'quiet', daysSinceLastActivity: 5, tasksThisWeek: 10, tasksDone: 1 },
      ],
    });
    expect(result.active).toBe(false);
  });

  it('returns inactive when weekly mode is not active', () => {
    const result = computeGravityState({
      ...baseInput,
      weeklyModeActive: false,
      attentionData: [
        { goalId: 'g1', energyLevel: 'quiet', daysSinceLastActivity: 5, tasksThisWeek: 10, tasksDone: 1 },
      ],
    });
    expect(result.active).toBe(false);
  });

  it('handles Infinity daysSinceLastActivity (no activity ever)', () => {
    const result = computeGravityState({
      ...baseInput,
      attentionData: [
        { goalId: 'g1', energyLevel: 'quiet', daysSinceLastActivity: Infinity, tasksThisWeek: 5, tasksDone: 0 },
      ],
    });
    expect(result.active).toBe(true);
    expect(result.staleGoalId).toBe('g1');
  });

  it('picks stalest when multiple are quiet', () => {
    const result = computeGravityState({
      ...baseInput,
      attentionData: [
        { goalId: 'g1', energyLevel: 'quiet', daysSinceLastActivity: 3, tasksThisWeek: 10, tasksDone: 2 },
        { goalId: 'g2', energyLevel: 'quiet', daysSinceLastActivity: 5, tasksThisWeek: 8, tasksDone: 1 },
      ],
    });
    expect(result.staleGoalId).toBe('g2');
  });

  it('releases when ANY stale intention gets focus, not just the stalest', () => {
    const result = computeGravityState({
      ...baseInput,
      attentionData: [
        { goalId: 'g1', energyLevel: 'quiet', daysSinceLastActivity: 3, tasksThisWeek: 10, tasksDone: 2 },
        { goalId: 'g2', energyLevel: 'quiet', daysSinceLastActivity: 5, tasksThisWeek: 8, tasksDone: 1 },
      ],
      todayTimeLogs: [
        { objectiveId: 'g1', durationMins: 6 },
      ],
    });
    expect(result.active).toBe(false);
  });

  it('treats exactly 40% satisfaction as not stale', () => {
    const result = computeGravityState({
      ...baseInput,
      attentionData: [
        { goalId: 'g1', energyLevel: 'quiet', daysSinceLastActivity: 5, tasksThisWeek: 5, tasksDone: 2 },
      ],
    });
    expect(result.active).toBe(false);
  });

  it('does not activate for steady intentions', () => {
    const result = computeGravityState({
      ...baseInput,
      attentionData: [
        { goalId: 'g1', energyLevel: 'steady', daysSinceLastActivity: 3, tasksThisWeek: 10, tasksDone: 1 },
      ],
    });
    expect(result.active).toBe(false);
  });
});
