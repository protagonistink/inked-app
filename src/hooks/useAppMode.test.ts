import { describe, it, expect } from 'vitest';
import { appModeReducer } from './useAppMode';
import type { AppModeState } from '../types/appMode';

const initial: AppModeState = { mode: 'briefing', view: 'flow', focusTaskId: null };

describe('appModeReducer', () => {
  it('transitions briefing -> planning on COMPLETE_BRIEFING', () => {
    const result = appModeReducer(initial, { type: 'COMPLETE_BRIEFING' });
    expect(result.mode).toBe('planning');
  });

  it('transitions planning -> executing on START_DAY', () => {
    const state: AppModeState = { mode: 'planning', view: 'flow', focusTaskId: null };
    const result = appModeReducer(state, { type: 'START_DAY' });
    expect(result.mode).toBe('executing');
  });

  it('transitions planning -> executing on CLICK_TASK', () => {
    const state: AppModeState = { mode: 'planning', view: 'flow', focusTaskId: null };
    const result = appModeReducer(state, { type: 'CLICK_TASK', taskId: 'task-1' });
    expect(result.mode).toBe('executing');
  });

  it('transitions executing -> focus on ENTER_FOCUS', () => {
    const state: AppModeState = { mode: 'executing', view: 'flow', focusTaskId: null };
    const result = appModeReducer(state, { type: 'ENTER_FOCUS', taskId: 'task-1' });
    expect(result.mode).toBe('focus');
    expect(result.focusTaskId).toBe('task-1');
  });

  it('transitions focus -> executing on EXIT_FOCUS', () => {
    const state: AppModeState = { mode: 'focus', view: 'flow', focusTaskId: 'task-1' };
    const result = appModeReducer(state, { type: 'EXIT_FOCUS' });
    expect(result.mode).toBe('executing');
    expect(result.focusTaskId).toBeNull();
  });

  it('transitions executing -> planning on OPEN_INBOX', () => {
    const state: AppModeState = { mode: 'executing', view: 'flow', focusTaskId: null };
    const result = appModeReducer(state, { type: 'OPEN_INBOX' });
    expect(result.mode).toBe('planning');
  });

  it('transitions planning -> executing on CLOSE_INBOX', () => {
    const state: AppModeState = { mode: 'planning', view: 'flow', focusTaskId: null };
    const result = appModeReducer(state, { type: 'CLOSE_INBOX' });
    expect(result.mode).toBe('executing');
  });

  it('resets to briefing on RESET_DAY', () => {
    const state: AppModeState = { mode: 'executing', view: 'flow', focusTaskId: null };
    const result = appModeReducer(state, { type: 'RESET_DAY' });
    expect(result.mode).toBe('briefing');
    expect(result.focusTaskId).toBeNull();
  });

  it('ignores invalid transitions', () => {
    // Can't enter focus from briefing
    const result = appModeReducer(initial, { type: 'ENTER_FOCUS', taskId: 'task-1' });
    expect(result.mode).toBe('briefing');
  });

  it('changes view with SET_VIEW', () => {
    const result = appModeReducer(initial, { type: 'SET_VIEW', view: 'intentions' });
    expect(result.view).toBe('intentions');
  });
});
