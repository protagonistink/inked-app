export type AppMode = 'briefing' | 'planning' | 'executing' | 'focus';
export type View = 'flow' | 'intentions';

export interface AppModeState {
  mode: AppMode;
  view: View;
  focusTaskId: string | null;
}

export type AppModeAction =
  | { type: 'COMPLETE_BRIEFING' }
  | { type: 'START_DAY' }
  | { type: 'CLICK_TASK'; taskId: string }
  | { type: 'ENTER_FOCUS'; taskId: string }
  | { type: 'EXIT_FOCUS' }
  | { type: 'OPEN_INBOX' }
  | { type: 'CLOSE_INBOX' }
  | { type: 'SET_VIEW'; view: View }
  | { type: 'RESET_DAY' };
