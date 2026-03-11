import { ipcMain } from 'electron';
import Store from 'electron-store';

const store = new Store({
  defaults: {
    anthropic: { apiKey: '' },
    asana: { token: '' },
    gcal: {
      clientId: '',
      clientSecret: '',
      calendarId: 'primary',
      calendarIds: ['primary'],
      writeCalendarId: 'primary',
    },
    pomodoro: { workMins: 25, breakMins: 5, longBreakMins: 15, longBreakInterval: 4 },
    focus: {
      blockedSites: [
        'reddit.com',
        'news.ycombinator.com',
        'twitter.com',
        'x.com',
        'youtube.com',
        'facebook.com',
        'instagram.com',
      ],
    },
    plannerState: {
      weeklyGoals: [],
      plannedTasks: [],
      dailyPlan: { date: '', committedTaskIds: [] },
    },
  },
});

export function registerStoreHandlers() {
  ipcMain.handle('store:get', (_event, key: string) => {
    return store.get(key);
  });

  ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
    store.set(key, value);
    return true;
  });
}

export { store };
