export type AppMode = 'briefing' | 'planning' | 'executing' | 'focus';
export type View = 'flow' | 'intentions';

export interface AppModeState {
  mode: AppMode;
  view: View;
  focusTaskId: string | null;
  inboxOpen: boolean;
}

export type AppModeAction =
  | { type: 'COMPLETE_BRIEFING' }
  | { type: 'OPEN_BRIEFING' }
  | { type: 'OPEN_PLANNING'; view?: View }
  | { type: 'START_DAY' }
  | { type: 'CLICK_TASK'; taskId: string }
  | { type: 'ENTER_FOCUS'; taskId: string }
  | { type: 'EXIT_FOCUS' }
  | { type: 'OPEN_INBOX' }
  | { type: 'CLOSE_INBOX' }
  | { type: 'TOGGLE_INBOX' }
  | { type: 'SET_VIEW'; view: View }
  | { type: 'RESET_DAY' };
