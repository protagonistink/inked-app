import { ipcMain, BrowserWindow, shell, Notification } from 'electron';
import { store } from './store';

interface PomodoroState {
  isRunning: boolean;
  isPaused: boolean;
  isBreak: boolean;
  timeRemaining: number;
  totalTime: number;
  currentTaskId: string | null;
  currentTaskTitle?: string | null;
  pomodoroCount: number;
}

interface LastPomodoroTask {
  taskId: string;
  taskTitle: string | null;
  startedAt: string;
}

let state: PomodoroState = {
  isRunning: false,
  isPaused: false,
  isBreak: false,
  timeRemaining: 0,
  totalTime: 0,
  currentTaskId: null,
  currentTaskTitle: null,
  pomodoroCount: 0,
};

let timerInterval: NodeJS.Timeout | null = null;
let trayUpdater: ((state: PomodoroState) => void) | null = null;
let focusTimerOpen: (() => void) | null = null;
let focusTimerClose: (() => void) | null = null;

export function setTrayUpdater(fn: (state: PomodoroState) => void) {
  trayUpdater = fn;
}

export function setFocusTimerCallbacks(open: () => void, close: () => void) {
  focusTimerOpen = open;
  focusTimerClose = close;
}

function getConfig() {
  return {
    workMins: (store.get('pomodoro.workMins') as number) || 25,
    breakMins: (store.get('pomodoro.breakMins') as number) || 5,
    longBreakMins: (store.get('pomodoro.longBreakMins') as number) || 15,
    longBreakInterval: (store.get('pomodoro.longBreakInterval') as number) || 4,
  };
}

function persistLastTask(taskId: string, taskTitle?: string | null) {
  const payload: LastPomodoroTask = {
    taskId,
    taskTitle: taskTitle || null,
    startedAt: new Date().toISOString(),
  };
  store.set('pomodoro.lastTask', payload);
}

function startPomodoroSession(taskId: string, taskTitle?: string, durationMins?: number) {
  const config = getConfig();
  const workMins = durationMins ?? config.workMins;
  persistLastTask(taskId, taskTitle);
  state = {
    isRunning: true,
    isPaused: false,
    isBreak: false,
    timeRemaining: workMins * 60,
    totalTime: workMins * 60,
    currentTaskId: taskId,
    currentTaskTitle: taskTitle || state.currentTaskTitle || null,
    pomodoroCount: state.pomodoroCount,
  };
  startTimer();
  broadcast();
  focusTimerOpen?.();
}

function playCue(kind: 'focus-end' | 'break-end') {
  const pattern = kind === 'focus-end' ? [0, 180] : [0];
  pattern.forEach((delay) => {
    setTimeout(() => {
      shell.beep();
    }, delay);
  });

  // Native notification so the user knows even when the app isn't visible
  const title = kind === 'focus-end' ? 'Focus session complete' : 'Break over';
  const body = kind === 'focus-end'
    ? `Time for a break. ${state.currentTaskTitle || ''}`
    : 'Ready for the next session.';

  const notification = new Notification({ title, body, silent: true });
  notification.show();
}

export function startLastUsedPomodoro(): LastPomodoroTask | null {
  const lastTask = store.get('pomodoro.lastTask') as LastPomodoroTask | undefined;
  if (!lastTask?.taskId) return null;
  startPomodoroSession(lastTask.taskId, lastTask.taskTitle || undefined);
  return lastTask;
}

function broadcast() {
  // Send state to all renderer windows
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('pomodoro:tick', state);
  });
  trayUpdater?.(state);
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (state.isRunning && !state.isPaused) {
      state.timeRemaining -= 1;

      if (state.timeRemaining <= 0) {
        // Timer complete
        if (!state.isBreak) {
          // Work session done — start break
          playCue('focus-end');
          state.pomodoroCount += 1;
          const config = getConfig();
          const isLongBreak = state.pomodoroCount % config.longBreakInterval === 0;
          state.isBreak = true;
          state.totalTime = (isLongBreak ? config.longBreakMins : config.breakMins) * 60;
          state.timeRemaining = state.totalTime;

        } else {
          // Break done — auto-start next work session with the same task
          playCue('break-end');
          const config = getConfig();
          state.isBreak = false;
          state.totalTime = config.workMins * 60;
          state.timeRemaining = config.workMins * 60;
          // isRunning stays true — seamless transition into next pomodoro
        }
      }

      broadcast();
    }
  }, 1000);
}

export function registerTimerHandlers() {
  ipcMain.handle('pomodoro:start', (_event, taskId: string, taskTitle?: string, durationMins?: number) => {
    startPomodoroSession(taskId, taskTitle, durationMins);
  });

  ipcMain.handle('pomodoro:pause', () => {
    state.isPaused = !state.isPaused;
    broadcast();
  });

  ipcMain.handle('pomodoro:stop', () => {
    state.isRunning = false;
    state.isPaused = false;
    state.timeRemaining = 0;
    state.currentTaskTitle = null;
    if (timerInterval) clearInterval(timerInterval);
    broadcast();
    focusTimerClose?.();
  });

  ipcMain.handle('pomodoro:skip', () => {
    state.timeRemaining = 0; // triggers completion on next tick
  });

  ipcMain.handle('pomodoro:extend-break', (_event, extraMins: number) => {
    if (!state.isBreak) return;
    const extra = Math.min(Math.max(extraMins, 1), 30) * 60;
    state.timeRemaining += extra;
    state.totalTime += extra;
    broadcast();
  });

  ipcMain.handle('pomodoro:load', (_event, taskId: string, taskTitle?: string) => {
    const config = getConfig();
    state = {
      ...state,
      isRunning: false,
      isPaused: false,
      isBreak: false,
      timeRemaining: config.workMins * 60,
      totalTime: config.workMins * 60,
      currentTaskId: taskId,
      currentTaskTitle: taskTitle ?? null,
    };
    broadcast();
  });
}
