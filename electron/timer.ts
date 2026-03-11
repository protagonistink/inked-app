import { ipcMain, BrowserWindow, shell } from 'electron';
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

export function setTrayUpdater(fn: (state: PomodoroState) => void) {
  trayUpdater = fn;
}

function getConfig() {
  return {
    workMins: (store.get('pomodoro.workMins') as number) || 25,
    breakMins: (store.get('pomodoro.breakMins') as number) || 5,
    longBreakMins: (store.get('pomodoro.longBreakMins') as number) || 15,
    longBreakInterval: (store.get('pomodoro.longBreakInterval') as number) || 4,
  };
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
          shell.beep();
          state.pomodoroCount += 1;
          const config = getConfig();
          const isLongBreak = state.pomodoroCount % config.longBreakInterval === 0;
          state.isBreak = true;
          state.totalTime = (isLongBreak ? config.longBreakMins : config.breakMins) * 60;
          state.timeRemaining = state.totalTime;

        } else {
          // Break done — ready for next work session
          shell.beep();
          state.isRunning = false;
          state.isBreak = false;
          state.timeRemaining = 0;
        }
      }

      broadcast();
    }
  }, 1000);
}

export function registerTimerHandlers() {
  ipcMain.handle('pomodoro:start', (_event, taskId: string, taskTitle?: string) => {
    const config = getConfig();
    state = {
      isRunning: true,
      isPaused: false,
      isBreak: false,
      timeRemaining: config.workMins * 60,
      totalTime: config.workMins * 60,
      currentTaskId: taskId,
      currentTaskTitle: taskTitle || state.currentTaskTitle || null,
      pomodoroCount: state.pomodoroCount,
    };
    startTimer();
    broadcast();
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
  });

  ipcMain.handle('pomodoro:skip', () => {
    state.timeRemaining = 0; // triggers completion on next tick
  });
}
