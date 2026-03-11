import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { registerAsanaHandlers } from './asana';
import { registerGCalHandlers } from './gcal';
import { registerStoreHandlers } from './store';
import { registerTimerHandlers, setTrayUpdater } from './timer';
import { registerFocusHandlers } from './focus';
import { registerAnthropicHandlers } from './anthropic';

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');
const APP_ICON_PATH = path.join(__dirname, '../build/icon.png');

let mainWindow: BrowserWindow | null;
let pomodoroWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#111214',
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main] did-finish-load', mainWindow?.webContents.getURL());
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[main] did-fail-load', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[main] render-process-gone', details);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log('[renderer]', { level, message, line, sourceId });
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'));
  }
}

function createTray() {
  const icon = nativeImage
    .createFromPath(APP_ICON_PATH)
    .resize({ width: 16, height: 16 });
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip('TimeFocus');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show TimeFocus',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.exit(); } },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow?.show();
    }
  });

  setTrayUpdater((state) => {
    if (!tray) return;
    if (!state.isRunning) {
      tray.setTitle('');
    } else {
      const mins = Math.floor(state.timeRemaining / 60);
      const secs = String(state.timeRemaining % 60).padStart(2, '0');
      const prefix = state.isPaused ? '⏸' : state.isBreak ? '☕' : '🍅';
      tray.setTitle(`${prefix} ${mins}:${secs}`);
    }
  });
}

function createPomodoroWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const width = 220;
  const height = 156;

  pomodoroWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 20,
    y: workArea.y + workArea.height - height - 20,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: true,
    show: false,
    backgroundColor: '#111214',
    icon: APP_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  pomodoroWindow.setAlwaysOnTop(true, 'screen-saver');
  pomodoroWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (VITE_DEV_SERVER_URL) {
    pomodoroWindow.loadURL(`${VITE_DEV_SERVER_URL}#/pomodoro`);
  } else {
    pomodoroWindow.loadFile(path.join(process.env.DIST!, 'index.html'), {
      hash: '/pomodoro',
    });
  }

  pomodoroWindow.on('closed', () => {
    pomodoroWindow = null;
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    mainWindow = null;
  }
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
});

app.whenReady().then(() => {
  registerAsanaHandlers();
  registerGCalHandlers();
  registerStoreHandlers();
  registerTimerHandlers();
  registerFocusHandlers();
  registerAnthropicHandlers();

  ipcMain.handle('window:show-pomodoro', () => {
    if (!pomodoroWindow) createPomodoroWindow();
    pomodoroWindow?.showInactive();
    pomodoroWindow?.moveTop();
  });

  ipcMain.handle('window:hide-pomodoro', () => {
    pomodoroWindow?.hide();
  });

  ipcMain.handle('window:activate', () => {
    app.focus({ steal: true });
    pomodoroWindow?.focus();
  });

  createWindow();
  createTray();
});
