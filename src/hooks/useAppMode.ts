import { useReducer, useEffect } from 'react';
import { format } from 'date-fns';
import type { AppModeState, AppModeAction, AppMode, View } from '../types/appMode';

const INITIAL_STATE: AppModeState = {
  mode: 'briefing',
  view: 'flow',
  focusTaskId: null,
};

export function appModeReducer(state: AppModeState, action: AppModeAction): AppModeState {
  switch (action.type) {
    case 'COMPLETE_BRIEFING':
      if (state.mode !== 'briefing') return state;
      return { ...state, mode: 'planning' };

    case 'START_DAY':
      if (state.mode !== 'planning') return state;
      return { ...state, mode: 'executing' };

    case 'CLICK_TASK':
      if (state.mode !== 'planning') return state;
      return { ...state, mode: 'executing' };

    case 'ENTER_FOCUS':
      if (state.mode !== 'executing') return state;
      return { ...state, mode: 'focus', focusTaskId: action.taskId };

    case 'EXIT_FOCUS':
      if (state.mode !== 'focus') return state;
      return { ...state, mode: 'executing', focusTaskId: null };

    case 'OPEN_INBOX':
      if (state.mode !== 'executing') return state;
      return { ...state, mode: 'planning' };

    case 'CLOSE_INBOX':
      if (state.mode !== 'planning') return state;
      return { ...state, mode: 'executing' };

    case 'SET_VIEW':
      return { ...state, view: action.view };

    case 'RESET_DAY':
      return { ...INITIAL_STATE };

    default:
      return state;
  }
}

const TODAY = format(new Date(), 'yyyy-MM-dd');

async function loadPersistedState(): Promise<AppModeState | null> {
  try {
    const storedDate = (await window.api.store.get('appModeDate')) as string | undefined;
    if (storedDate !== TODAY) return null;

    const mode = (await window.api.store.get('appMode')) as AppMode | undefined;
    const view = (await window.api.store.get('appModeView')) as View | undefined;
    const focusTaskId = (await window.api.store.get('appModeFocusTaskId')) as string | null | undefined;

    if (!mode) return null;

    return {
      mode: mode ?? INITIAL_STATE.mode,
      view: view ?? INITIAL_STATE.view,
      focusTaskId: focusTaskId ?? null,
    };
  } catch {
    return null;
  }
}

function persistState(state: AppModeState): void {
  try {
    void window.api.store.set('appModeDate', TODAY);
    void window.api.store.set('appMode', state.mode);
    void window.api.store.set('appModeView', state.view);
    void window.api.store.set('appModeFocusTaskId', state.focusTaskId);
  } catch {
    // Silently fail outside Electron context
  }
}

export function useAppMode() {
  const [state, dispatch] = useReducer(appModeReducer, INITIAL_STATE);

  // Restore persisted state on mount (async, same-day only)
  useEffect(() => {
    loadPersistedState().then((persisted) => {
      if (persisted) {
        dispatch({ type: 'SET_VIEW', view: persisted.view });
        // Replay mode transitions to reach persisted mode without bypassing the reducer
        if (persisted.mode === 'planning') {
          dispatch({ type: 'COMPLETE_BRIEFING' });
        } else if (persisted.mode === 'executing' || persisted.mode === 'focus') {
          dispatch({ type: 'COMPLETE_BRIEFING' });
          dispatch({ type: 'START_DAY' });
          if (persisted.mode === 'focus' && persisted.focusTaskId) {
            dispatch({ type: 'ENTER_FOCUS', taskId: persisted.focusTaskId });
          }
        }
      }
    }).catch(() => {
      // Ignore restore errors
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persistState(state);
  }, [state]);

  return {
    state,
    completeBriefing: () => dispatch({ type: 'COMPLETE_BRIEFING' }),
    startDay: () => dispatch({ type: 'START_DAY' }),
    clickTask: (taskId: string) => dispatch({ type: 'CLICK_TASK', taskId }),
    enterFocus: (taskId: string) => dispatch({ type: 'ENTER_FOCUS', taskId }),
    exitFocus: () => dispatch({ type: 'EXIT_FOCUS' }),
    openInbox: () => dispatch({ type: 'OPEN_INBOX' }),
    closeInbox: () => dispatch({ type: 'CLOSE_INBOX' }),
    setView: (view: View) => dispatch({ type: 'SET_VIEW', view }),
    resetDay: () => dispatch({ type: 'RESET_DAY' }),
  };
}
